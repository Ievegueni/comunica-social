import { env } from '../../config/env.js';
import { prisma } from '../prisma.js';
import { decrypt } from '../crypto.js';
import { logger } from '../logger.js';

const META_API_BASE = 'https://graph.facebook.com/v18.0';

interface MetaApiOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  params?: Record<string, string>;
  body?: Record<string, unknown>;
}

export async function metaApiFetch(
  endpoint: string,
  accessToken: string,
  options: MetaApiOptions = {},
) {
  const { method = 'GET', params = {}, body } = options;

  const url = new URL(`${META_API_BASE}${endpoint}`);
  url.searchParams.set('access_token', accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const fetchOptions: RequestInit = { method };
  if (body) {
    fetchOptions.headers = { 'Content-Type': 'application/json' };
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), fetchOptions);
  const data = await response.json();

  if (!response.ok) {
    logger.error({ endpoint, error: data }, 'Meta API error');
    throw new MetaApiError(data.error?.message || 'Meta API error', data.error?.code);
  }

  return data;
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    public code?: number,
  ) {
    super(message);
    this.name = 'MetaApiError';
  }
}

/**
 * Get a decrypted Meta client for a specific social account.
 * Automatically decrypts the stored token.
 */
export async function getMetaClient(socialAccountId: string, tenantId: string) {
  const account = await prisma.socialAccount.findFirst({
    where: { id: socialAccountId, tenantId },
  });

  if (!account) {
    throw new Error('Social account not found');
  }

  if (account.status !== 'ACTIVE') {
    throw new Error(`Social account status: ${account.status}`);
  }

  const accessToken = decrypt(account.accessTokenEnc);

  return {
    account,
    accessToken,
    fetch: (endpoint: string, options?: MetaApiOptions) =>
      metaApiFetch(endpoint, accessToken, options),
  };
}

/**
 * Exchange short-lived token for long-lived token (60 days)
 */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const data = await metaApiFetch('/oauth/access_token', shortLivedToken, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: env.META_APP_ID ?? '',
      client_secret: env.META_APP_SECRET ?? '',
      fb_exchange_token: shortLivedToken,
    },
  });

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 5184000, // Default 60 days
  };
}

/**
 * Get list of Facebook pages the user manages
 */
export async function getUserPages(userAccessToken: string) {
  const data = await metaApiFetch('/me/accounts', userAccessToken, {
    params: { fields: 'id,name,access_token,category,picture' },
  });

  return data.data as Array<{
    id: string;
    name: string;
    access_token: string;
    category: string;
    picture?: { data?: { url?: string } };
  }>;
}

/**
 * Get Instagram Business Account linked to a Facebook page
 */
export async function getInstagramAccount(pageId: string, pageAccessToken: string) {
  const data = await metaApiFetch(`/${pageId}`, pageAccessToken, {
    params: { fields: 'instagram_business_account{id,name,username,profile_picture_url}' },
  });

  return data.instagram_business_account as
    | {
        id: string;
        name?: string;
        username?: string;
        profile_picture_url?: string;
      }
    | undefined;
}

/**
 * Refresh a page access token (page tokens don't expire if obtained from long-lived user token)
 * For user tokens, exchange again for long-lived
 */
export async function refreshLongLivedToken(currentToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  return exchangeForLongLivedToken(currentToken);
}
