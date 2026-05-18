import { Worker, Queue, Job } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { decrypt } from '../lib/crypto.js';
import { publishToFacebook, publishToInstagram } from '../lib/meta/publisher.js';
import { refreshAccountToken } from '../modules/social-accounts/service.js';
import { scheduleMetricsCollection } from './metrics-collector.js';

const QUEUE_NAME = 'post-publisher';

export const postPublisherQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'custom',
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

interface PublishJobData {
  postId: string;
  tenantId: string;
}

export function startPostPublisherWorker() {
  const worker = new Worker<PublishJobData>(
    QUEUE_NAME,
    async (job: Job<PublishJobData>) => {
      const { postId, tenantId } = job.data;

      logger.info({ postId, tenantId, attempt: job.attemptsMade + 1 }, 'Processing publish job');

      // Load post with related data
      const post = await prisma.post.findFirst({
        where: { id: postId, tenantId },
        include: {
          socialAccount: true,
          media: {
            include: { mediaAsset: true },
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!post) {
        logger.warn({ postId }, 'Post not found, skipping');
        return;
      }

      // Skip if already published or cancelled
      if (['PUBLISHED', 'CANCELLED'].includes(post.status)) {
        logger.info({ postId, status: post.status }, 'Post already processed, skipping');
        return;
      }

      // Validate token is not expired BEFORE changing status
      const account = post.socialAccount;
      if (account.status === 'TOKEN_EXPIRED' || account.tokenExpiresAt < new Date()) {
        try {
          await refreshAccountToken(account.id);
          logger.info({ accountId: account.id }, 'Token refreshed before publish');
        } catch {
          await markFailed(postId, tenantId, 'Token expired and refresh failed');
          throw new Error('Token expired and refresh failed');
        }
      }

      // Get decrypted token (re-fetch in case it was refreshed)
      const freshAccount = await prisma.socialAccount.findUnique({
        where: { id: account.id },
      });
      if (!freshAccount || freshAccount.status !== 'ACTIVE') {
        await markFailed(postId, tenantId, 'Social account not active');
        throw new Error('Social account not active');
      }

      // All validations passed — now update status to PUBLISHING
      await prisma.post.update({
        where: { id: postId },
        data: { status: 'PUBLISHING' },
      });

      const accessToken = decrypt(freshAccount.accessTokenEnc);
      const mediaUrls = post.media.map((m) => m.mediaAsset.url);

      try {
        let result;

        if (account.platform === 'FACEBOOK') {
          result = await publishToFacebook({
            content: post.content,
            mediaUrls,
            accessToken,
            externalId: account.externalId,
          });
        } else {
          result = await publishToInstagram({
            content: post.content,
            mediaUrls,
            accessToken,
            externalId: account.externalId,
            pageId: account.pageId || undefined,
          });
        }

        // Mark as published
        await prisma.post.update({
          where: { id: postId },
          data: {
            status: 'PUBLISHED',
            externalPostId: result.externalPostId,
            publishedAt: new Date(),
            errorMessage: null,
          },
        });

        await prisma.auditLog.create({
          data: {
            tenantId,
            action: 'POST_PUBLISHED',
            entityType: 'Post',
            entityId: postId,
            metadata: { platform: account.platform, externalPostId: result.externalPostId },
          },
        });

        // Schedule metrics collection
        await scheduleMetricsCollection(postId, tenantId);

        logger.info(
          { postId, platform: account.platform, externalPostId: result.externalPostId },
          'Post published successfully',
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error({ postId, platform: account.platform, err }, 'Failed to publish post');

        // If this is the last attempt, mark as FAILED
        if (job.attemptsMade + 1 >= (job.opts.attempts || 3)) {
          await markFailed(postId, tenantId, message);
        } else {
          // Revert to SCHEDULED for retry
          await prisma.post.update({
            where: { id: postId },
            data: { status: 'SCHEDULED', errorMessage: message, retryCount: job.attemptsMade + 1 },
          });
        }

        throw err; // Rethrow for BullMQ retry
      }
    },
    {
      connection: redis,
      concurrency: 5,
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          // 1min, 5min, 30min
          const delays = [60000, 300000, 1800000];
          return delays[attemptsMade - 1] || 1800000;
        },
      },
    },
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, postId: job?.data.postId, err: err.message },
      'Post publisher job failed',
    );
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, postId: job.data.postId }, 'Post publisher job completed');
  });

  return worker;
}

async function markFailed(postId: string, tenantId: string, errorMessage: string) {
  await prisma.post.update({
    where: { id: postId },
    data: { status: 'FAILED', errorMessage },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      action: 'POST_FAILED',
      entityType: 'Post',
      entityId: postId,
      metadata: { errorMessage },
    },
  });
}

/**
 * Schedule a post for publishing at its scheduledFor time.
 */
export async function schedulePostJob(postId: string, tenantId: string, scheduledFor: Date) {
  const delay = Math.max(0, scheduledFor.getTime() - Date.now());
  const jobId = `publish-${postId}`;

  // Remove existing job for this post if any
  await cancelPostJob(postId);

  await postPublisherQueue.add(
    'publish',
    { postId, tenantId },
    {
      jobId,
      delay,
    },
  );

  logger.info({ postId, delay, scheduledFor }, 'Post publish job scheduled');
}

/**
 * Cancel a scheduled post job.
 */
export async function cancelPostJob(postId: string) {
  const jobId = `publish-${postId}`;

  const job = await postPublisherQueue.getJob(jobId);
  if (job) {
    const state = await job.getState();
    if (state === 'delayed' || state === 'waiting') {
      await job.remove();
      logger.info({ postId, jobId }, 'Post publish job cancelled');
    }
  }
}
