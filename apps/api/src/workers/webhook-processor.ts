import { Worker, Queue, Job } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const QUEUE_NAME = 'webhook-processor';

export const webhookProcessorQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 200,
    removeOnFail: 100,
  },
});

interface WebhookJobData {
  object: string;
  entry: {
    id: string;
    time: number;
    changes?: Array<{ field: string; value: Record<string, unknown> }>;
    messaging?: Array<Record<string, unknown>>;
  };
}

export function startWebhookProcessorWorker() {
  const worker = new Worker<WebhookJobData>(
    QUEUE_NAME,
    async (job: Job<WebhookJobData>) => {
      const { object, entry } = job.data;

      logger.info({ object, entryId: entry.id }, 'Processing webhook entry');

      if (object === 'page') {
        await processPageEvents(entry);
      } else if (object === 'instagram') {
        await processInstagramEvents(entry);
      }
    },
    {
      connection: redis,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Webhook processor job failed');
  });

  return worker;
}

async function processPageEvents(entry: WebhookJobData['entry']) {
  const pageId = entry.id;

  // Find social account by externalId
  const account = await prisma.socialAccount.findFirst({
    where: { externalId: pageId, platform: 'FACEBOOK' },
  });

  if (!account) {
    logger.warn({ pageId }, 'No account found for page webhook');
    return;
  }

  if (entry.changes) {
    for (const change of entry.changes) {
      if (change.field === 'feed') {
        await processFeedComment(account.id, account.tenantId, change.value);
      }
    }
  }

  if (entry.messaging) {
    for (const message of entry.messaging) {
      await processMessengerMessage(account.id, account.tenantId, message);
    }
  }
}

async function processInstagramEvents(entry: WebhookJobData['entry']) {
  const igUserId = entry.id;

  const account = await prisma.socialAccount.findFirst({
    where: { externalId: igUserId, platform: 'INSTAGRAM' },
  });

  if (!account) {
    logger.warn({ igUserId }, 'No account found for IG webhook');
    return;
  }

  if (entry.changes) {
    for (const change of entry.changes) {
      if (change.field === 'comments') {
        await processIGComment(account.id, account.tenantId, change.value);
      } else if (change.field === 'messages') {
        await processIGDM(account.id, account.tenantId, change.value);
      }
    }
  }
}

async function processFeedComment(
  socialAccountId: string,
  tenantId: string,
  value: Record<string, unknown>,
) {
  const item = value.item as string;
  if (item !== 'comment') return;

  const commentId = value.comment_id as string;
  const fromId = (value.from as Record<string, unknown>)?.id as string;
  const fromName = (value.from as Record<string, unknown>)?.name as string;
  const message = value.message as string;
  const postId = value.post_id as string;

  if (!commentId || !message) return;

  // Check if already exists
  const existing = await prisma.inboxItem.findUnique({
    where: { socialAccountId_externalId: { socialAccountId, externalId: commentId } },
  });
  if (existing) return;

  // Try to link to our post
  let parentPostId: string | undefined;
  if (postId) {
    const post = await prisma.post.findFirst({
      where: { tenantId, externalPostId: postId },
    });
    if (post) parentPostId = post.id;
  }

  await prisma.inboxItem.create({
    data: {
      tenantId,
      socialAccountId,
      type: 'COMMENT_FB',
      externalId: commentId,
      parentPostId,
      fromUserId: fromId || 'unknown',
      fromUserName: fromName || 'Utilizador',
      content: message,
      status: 'UNREAD',
      receivedAt: new Date(),
    },
  });

  logger.info({ commentId, tenantId }, 'FB comment ingested');
}

async function processIGComment(
  socialAccountId: string,
  tenantId: string,
  value: Record<string, unknown>,
) {
  const commentId = value.id as string;
  const text = value.text as string;
  const fromId = (value.from as Record<string, unknown>)?.id as string;
  const fromName = (value.from as Record<string, unknown>)?.username as string;
  const mediaId = value.media as Record<string, unknown>;

  if (!commentId || !text) return;

  const existing = await prisma.inboxItem.findUnique({
    where: { socialAccountId_externalId: { socialAccountId, externalId: commentId } },
  });
  if (existing) return;

  let parentPostId: string | undefined;
  if (mediaId?.id) {
    const post = await prisma.post.findFirst({
      where: { tenantId, externalPostId: mediaId.id as string },
    });
    if (post) parentPostId = post.id;
  }

  await prisma.inboxItem.create({
    data: {
      tenantId,
      socialAccountId,
      type: 'COMMENT_IG',
      externalId: commentId,
      parentPostId,
      fromUserId: fromId || 'unknown',
      fromUserName: fromName || 'Utilizador',
      content: text,
      status: 'UNREAD',
      receivedAt: new Date(),
    },
  });

  logger.info({ commentId, tenantId }, 'IG comment ingested');
}

async function processMessengerMessage(
  socialAccountId: string,
  tenantId: string,
  messageData: Record<string, unknown>,
) {
  const sender = messageData.sender as Record<string, unknown>;
  const messageObj = messageData.message as Record<string, unknown>;
  if (!sender?.id || !messageObj?.mid) return;

  const externalId = messageObj.mid as string;
  const text = (messageObj.text as string) || '[media]';

  const existing = await prisma.inboxItem.findUnique({
    where: { socialAccountId_externalId: { socialAccountId, externalId } },
  });
  if (existing) return;

  await prisma.inboxItem.create({
    data: {
      tenantId,
      socialAccountId,
      type: 'DM_MESSENGER',
      externalId,
      fromUserId: sender.id as string,
      fromUserName: (sender.name as string) || 'Utilizador',
      content: text,
      status: 'UNREAD',
      receivedAt: new Date((messageData.timestamp as number) || Date.now()),
    },
  });

  logger.info({ externalId, tenantId }, 'Messenger DM ingested');
}

async function processIGDM(
  socialAccountId: string,
  tenantId: string,
  value: Record<string, unknown>,
) {
  const senderId =
    (value.sender_id as string) || ((value.from as Record<string, unknown>)?.id as string);
  const messageId = (value.mid as string) || (value.id as string);
  const text = (value.text as string) || (value.message as string) || '[media]';

  if (!messageId) return;

  const existing = await prisma.inboxItem.findUnique({
    where: { socialAccountId_externalId: { socialAccountId, externalId: messageId } },
  });
  if (existing) return;

  await prisma.inboxItem.create({
    data: {
      tenantId,
      socialAccountId,
      type: 'DM_INSTAGRAM',
      externalId: messageId,
      fromUserId: senderId || 'unknown',
      fromUserName: 'Utilizador',
      content: text,
      status: 'UNREAD',
      receivedAt: new Date(),
    },
  });

  logger.info({ messageId, tenantId }, 'IG DM ingested');
}
