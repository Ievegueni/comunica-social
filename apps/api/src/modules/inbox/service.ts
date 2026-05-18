import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { metaApiFetch } from '../../lib/meta/client.js';
import { decrypt } from '../../lib/crypto.js';
import { ListInboxQuery, ReplyInput } from './schemas.js';

export async function listInbox(tenantId: string, query: ListInboxQuery) {
  const where: Prisma.InboxItemWhereInput = { tenantId };

  if (query.type) where.type = query.type;
  if (query.status) where.status = query.status;
  if (query.socialAccountId) where.socialAccountId = query.socialAccountId;

  const [items, total, unreadCount] = await Promise.all([
    prisma.inboxItem.findMany({
      where,
      include: {
        socialAccount: { select: { id: true, platform: true, name: true } },
        replies: { orderBy: { sentAt: 'desc' }, take: 1 },
      },
      orderBy: { receivedAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.inboxItem.count({ where }),
    prisma.inboxItem.count({ where: { tenantId, status: 'UNREAD' } }),
  ]);

  return {
    items,
    total,
    unreadCount,
    page: query.page,
    totalPages: Math.ceil(total / query.limit),
  };
}

export async function getInboxItem(tenantId: string, itemId: string) {
  const item = await prisma.inboxItem.findFirst({
    where: { id: itemId, tenantId },
    include: {
      socialAccount: { select: { id: true, platform: true, name: true } },
      replies: { orderBy: { sentAt: 'asc' } },
    },
  });
  if (!item) throw new AppError(404, 'Inbox item not found');

  // Auto-mark as read
  if (item.status === 'UNREAD') {
    await prisma.inboxItem.update({
      where: { id: itemId },
      data: { status: 'READ' },
    });
    item.status = 'READ';
  }

  return item;
}

export async function replyToItem(
  tenantId: string,
  itemId: string,
  userId: string,
  input: ReplyInput,
) {
  const item = await prisma.inboxItem.findFirst({
    where: { id: itemId, tenantId },
    include: { socialAccount: true },
  });
  if (!item) throw new AppError(404, 'Inbox item not found');

  const account = item.socialAccount;
  const accessToken = decrypt(account.accessTokenEnc);
  let externalId: string | undefined;

  // Send reply via Meta API
  if (item.type === 'COMMENT_FB' || item.type === 'COMMENT_IG') {
    const response = await metaApiFetch(`/${item.externalId}/replies`, accessToken, {
      method: 'POST',
      body: { message: input.content },
    });
    externalId = response.id;
  } else if (item.type === 'DM_MESSENGER') {
    const response = await metaApiFetch('/me/messages', accessToken, {
      method: 'POST',
      body: {
        recipient: { id: item.fromUserId },
        message: { text: input.content },
      },
    });
    externalId = response.message_id;
  } else if (item.type === 'DM_INSTAGRAM') {
    const response = await metaApiFetch(`/${account.externalId}/messages`, accessToken, {
      method: 'POST',
      body: {
        recipient: { id: item.fromUserId },
        message: { text: input.content },
      },
    });
    externalId = response.message_id || response.id;
  }

  // Save reply
  const reply = await prisma.inboxReply.create({
    data: {
      inboxItemId: itemId,
      content: input.content,
      sentById: userId,
      externalId,
    },
  });

  // Update item status
  await prisma.inboxItem.update({
    where: { id: itemId },
    data: { status: 'REPLIED', repliedAt: new Date(), repliedById: userId },
  });

  return reply;
}

export async function updateItemStatus(
  tenantId: string,
  itemId: string,
  status: 'READ' | 'ARCHIVED',
) {
  const item = await prisma.inboxItem.findFirst({ where: { id: itemId, tenantId } });
  if (!item) throw new AppError(404, 'Inbox item not found');

  return prisma.inboxItem.update({
    where: { id: itemId },
    data: { status },
  });
}
