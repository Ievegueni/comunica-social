import { Worker, Queue } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { refreshAccountToken } from '../modules/social-accounts/service.js';

const QUEUE_NAME = 'token-refresher';

export const tokenRefresherQueue = new Queue(QUEUE_NAME, {
  connection: redis,
});

export function startTokenRefresherWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      logger.info('Running token refresh job');

      // Find accounts with tokens expiring in less than 10 days
      const tenDaysFromNow = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

      const accounts = await prisma.socialAccount.findMany({
        where: {
          status: 'ACTIVE',
          tokenExpiresAt: { lt: tenDaysFromNow },
        },
      });

      logger.info({ count: accounts.length }, 'Accounts needing token refresh');

      for (const account of accounts) {
        try {
          await refreshAccountToken(account.id);
          logger.info({ accountId: account.id, name: account.name }, 'Token refreshed');
        } catch (err) {
          logger.error({ accountId: account.id, err }, 'Failed to refresh token');

          // Mark as expired if refresh fails
          await prisma.socialAccount.update({
            where: { id: account.id },
            data: { status: 'TOKEN_EXPIRED' },
          });
        }
      }
    },
    { connection: redis },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Token refresher job failed');
  });

  return worker;
}

/**
 * Schedule daily token refresh (call on server startup)
 */
export async function scheduleTokenRefresh() {
  // Remove existing repeatable jobs
  const repeatableJobs = await tokenRefresherQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await tokenRefresherQueue.removeRepeatableByKey(job.key);
  }

  // Schedule to run daily at 3 AM
  await tokenRefresherQueue.add(
    'refresh-tokens',
    {},
    {
      repeat: { pattern: '0 3 * * *' },
    },
  );

  logger.info('Token refresher scheduled (daily at 3 AM)');
}
