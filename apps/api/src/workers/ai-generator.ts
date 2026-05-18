import { Worker, Queue, Job } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { generatePosts } from '../lib/anthropic.js';

const QUEUE_NAME = 'ai-generator';

export const aiGeneratorQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 30000 },
    removeOnComplete: 50,
    removeOnFail: 50,
  },
});

interface AIJobData {
  jobId: string;
  tenantId: string;
  briefing: string;
  tone: string;
  count: number;
}

export function startAIGeneratorWorker() {
  const worker = new Worker<AIJobData>(
    QUEUE_NAME,
    async (job: Job<AIJobData>) => {
      const { jobId, tenantId, briefing, tone, count } = job.data;

      logger.info({ jobId, tenantId, count }, 'Processing AI generation job');

      // Update status to PROCESSING
      await prisma.aIGenerationJob.update({
        where: { id: jobId },
        data: { status: 'PROCESSING' },
      });

      try {
        const posts = await generatePosts({ briefing, tone, count });

        await prisma.aIGenerationJob.update({
          where: { id: jobId },
          data: {
            status: 'COMPLETED',
            result: JSON.parse(JSON.stringify(posts)),
            completedAt: new Date(),
          },
        });

        logger.info({ jobId, generated: posts.length }, 'AI generation completed');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error({ jobId, err }, 'AI generation failed');

        await prisma.aIGenerationJob.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            errorMessage: message,
            completedAt: new Date(),
          },
        });

        throw err;
      }
    },
    {
      connection: redis,
      concurrency: 2,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'AI generator job failed');
  });

  return worker;
}
