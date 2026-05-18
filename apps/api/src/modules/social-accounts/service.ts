import { prisma } from '../../lib/prisma.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { AppError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import {
  exchangeForLongLivedToken,
  getUserPages,
  getInstagramAccount,
} from '../../lib/meta/client.js';
import { ConnectAccountInput } from './schemas.js';

const META_OAUTH_URL = 'https://www.facebook.com/v18.0/dialog/oauth';

export function getMetaOAuthUrl(state: string) {
  if (!env.META_APP_ID || !env.META_REDIRECT_URI) {
    throw new AppError(500, 'Meta integration not configured');
  }

  const params = new URLSearchParams({
    client_id: env.META_APP_ID,
    redirect_uri: env.META_REDIRECT_URI,
    state,
    scope: [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'pages_manage_engagement',
      'pages_messaging',
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments',
      'instagram_manage_messages',
      'business_management',
    ].join(','),
    response_type: 'code',
  });

  return `${META_OAUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  if (!env.META_APP_ID || !env.META_APP_SECRET || !env.META_REDIRECT_URI) {
    throw new AppError(500, 'Meta integration not configured');
  }

  const url = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
  url.searchParams.set('client_id', env.META_APP_ID);
  url.searchParams.set('client_secret', env.META_APP_SECRET);
  url.searchParams.set('redirect_uri', env.META_REDIRECT_URI);
  url.searchParams.set('code', code);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new AppError(400, data.error?.message || 'Failed to exchange code');
  }

  return data.access_token;
}

export async function getAvailableAccounts(shortLivedToken: string) {
  // Exchange for long-lived token
  const { accessToken } = await exchangeForLongLivedToken(shortLivedToken);

  // Get FB pages
  const pages = await getUserPages(accessToken);

  // For each page, check for IG business account
  const accounts = [];

  for (const page of pages) {
    accounts.push({
      platform: 'FACEBOOK' as const,
      externalId: page.id,
      name: page.name,
      accessToken: page.access_token,
      category: page.category,
      picture: page.picture?.data?.url,
    });

    const igAccount = await getInstagramAccount(page.id, page.access_token);
    if (igAccount) {
      accounts.push({
        platform: 'INSTAGRAM' as const,
        externalId: igAccount.id,
        name: igAccount.username || igAccount.name || `IG - ${page.name}`,
        accessToken: page.access_token, // IG uses page token
        pageId: page.id,
        picture: igAccount.profile_picture_url,
      });
    }
  }

  return accounts;
}

export async function connectAccount(tenantId: string, userId: string, input: ConnectAccountInput) {
  // Check if already connected
  const existing = await prisma.socialAccount.findUnique({
    where: {
      tenantId_platform_externalId: {
        tenantId,
        platform: input.platform,
        externalId: input.externalId,
      },
    },
  });

  if (existing) {
    throw new AppError(409, 'Account already connected');
  }

  // Exchange for long-lived token
  const { accessToken, expiresIn } = await exchangeForLongLivedToken(input.accessToken);

  // Encrypt token
  const accessTokenEnc = encrypt(accessToken);
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

  const account = await prisma.socialAccount.create({
    data: {
      tenantId,
      platform: input.platform,
      externalId: input.externalId,
      name: input.name,
      accessTokenEnc,
      tokenExpiresAt,
      pageId: input.pageId,
      status: 'ACTIVE',
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'SOCIAL_ACCOUNT_CONNECTED',
      entityType: 'SocialAccount',
      entityId: account.id,
      metadata: { platform: input.platform, name: input.name },
    },
  });

  return {
    id: account.id,
    platform: account.platform,
    externalId: account.externalId,
    name: account.name,
    status: account.status,
    tokenExpiresAt: account.tokenExpiresAt,
    connectedAt: account.connectedAt,
  };
}

export async function listAccounts(tenantId: string) {
  return prisma.socialAccount.findMany({
    where: { tenantId, status: { not: 'REVOKED' } },
    select: {
      id: true,
      platform: true,
      externalId: true,
      name: true,
      status: true,
      tokenExpiresAt: true,
      connectedAt: true,
      lastTokenRefresh: true,
      pageId: true,
    },
    orderBy: { connectedAt: 'desc' },
  });
}

export async function disconnectAccount(tenantId: string, accountId: string, userId: string) {
  const account = await prisma.socialAccount.findFirst({
    where: { id: accountId, tenantId },
  });

  if (!account) {
    throw new AppError(404, 'Account not found');
  }

  // Check for scheduled/publishing posts
  const activePosts = await prisma.post.count({
    where: {
      socialAccountId: accountId,
      status: { in: ['SCHEDULED', 'PUBLISHING', 'PENDING_APPROVAL'] },
    },
  });

  if (activePosts > 0) {
    throw new AppError(
      400,
      `Cannot disconnect: ${activePosts} active post(s) use this account. Cancel them first.`,
    );
  }

  // Revoke instead of hard delete to preserve post history
  await prisma.socialAccount.update({
    where: { id: accountId },
    data: { status: 'REVOKED' },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'SOCIAL_ACCOUNT_DISCONNECTED',
      entityType: 'SocialAccount',
      entityId: accountId,
      metadata: { platform: account.platform, name: account.name },
    },
  });
}

export async function refreshAccountToken(accountId: string) {
  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error('Account not found');

  const currentToken = decrypt(account.accessTokenEnc);
  const { accessToken, expiresIn } = await exchangeForLongLivedToken(currentToken);

  const accessTokenEnc = encrypt(accessToken);
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

  await prisma.socialAccount.update({
    where: { id: accountId },
    data: {
      accessTokenEnc,
      tokenExpiresAt,
      lastTokenRefresh: new Date(),
      status: 'ACTIVE',
    },
  });
}
