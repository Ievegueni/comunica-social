import { Worker, Queue, Job } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { decrypt } from '../lib/crypto.js';
import { metaApiFetch } from '../lib/meta/client.js';

const QUEUE_NAME = 'metrics-collector';

export const metricsCollectorQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 60000 },
    removeOnComplete: 200,
    removeOnFail: 100,
  },
});

interface MetricsJobData {
  postId: string;
  tenantId: string;
}

export function startMetricsCollectorWorker() {
  const worker = new Worker<MetricsJobData>(
    QUEUE_NAME,
    async (job: Job<MetricsJobData>) => {
      const { postId, tenantId } = job.data;

      const post = await prisma.post.findFirst({
        where: { id: postId, tenantId, status: 'PUBLISHED' },
        include: { socialAccount: true },
      });

      if (!post || !post.externalPostId) {
        logger.warn({ postId }, 'Post not found or not published, skipping metrics');
        return;
      }

      const accessToken = decrypt(post.socialAccount.accessTokenEnc);

      try {
        let metrics = { reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0 };

        if (post.socialAccount.platform === 'FACEBOOK') {
          metrics = await collectFBMetrics(post.externalPostId, accessToken);
        } else {
          metrics = await collectIGMetrics(post.externalPostId, accessToken);
        }

        await prisma.postMetric.create({
          data: {
            postId,
            ...metrics,
          },
        });

        logger.info({ postId, metrics }, 'Metrics collected');
      } catch (err) {
        logger.error({ postId, err }, 'Failed to collect metrics');
        throw err;
      }
    },
    {
      connection: redis,
      concurrency: 3,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Metrics collector job failed');
  });

  return worker;
}

async function collectFBMetrics(externalPostId: string, accessToken: string) {
  try {
    // Get basic post data
    const postData = await metaApiFetch(`/${externalPostId}`, accessToken, {
      params: { fields: 'likes.summary(true),comments.summary(true),shares' },
    });

    const likes = postData.likes?.summary?.total_count || 0;
    const comments = postData.comments?.summary?.total_count || 0;
    const shares = postData.shares?.count || 0;

    // Try to get insights
    let reach = 0;
    let impressions = 0;
    try {
      const insights = await metaApiFetch(`/${externalPostId}/insights`, accessToken, {
        params: { metric: 'post_impressions,post_impressions_unique' },
      });
      if (insights.data) {
        for (const metric of insights.data) {
          if (metric.name === 'post_impressions') impressions = metric.values?.[0]?.value || 0;
          if (metric.name === 'post_impressions_unique') reach = metric.values?.[0]?.value || 0;
        }
      }
    } catch {
      // Insights may not be available for all posts
    }

    return { reach, impressions, likes, comments, shares, saves: 0 };
  } catch {
    return { reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0 };
  }
}

async function collectIGMetrics(externalPostId: string, accessToken: string) {
  try {
    const insights = await metaApiFetch(`/${externalPostId}/insights`, accessToken, {
      params: { metric: 'reach,impressions,likes,comments,shares,saved' },
    });

    const metrics = { reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0 };

    if (insights.data) {
      for (const metric of insights.data) {
        switch (metric.name) {
          case 'reach':
            metrics.reach = metric.values?.[0]?.value || 0;
            break;
          case 'impressions':
            metrics.impressions = metric.values?.[0]?.value || 0;
            break;
          case 'likes':
            metrics.likes = metric.values?.[0]?.value || 0;
            break;
          case 'comments':
            metrics.comments = metric.values?.[0]?.value || 0;
            break;
          case 'shares':
            metrics.shares = metric.values?.[0]?.value || 0;
            break;
          case 'saved':
            metrics.saves = metric.values?.[0]?.value || 0;
            break;
        }
      }
    }

    return metrics;
  } catch {
    // Fallback to basic fields
    try {
      const media = await metaApiFetch(`/${externalPostId}`, accessToken, {
        params: { fields: 'like_count,comments_count' },
      });
      return {
        reach: 0,
        impressions: 0,
        likes: media.like_count || 0,
        comments: media.comments_count || 0,
        shares: 0,
        saves: 0,
      };
    } catch {
      return { reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0 };
    }
  }
}

/**
 * Schedule metrics collection for a published post.
 * Collects at 1h, 24h, 7d after publishing.
 */
export async function scheduleMetricsCollection(postId: string, tenantId: string) {
  const delays = [
    3600000, // 1 hour
    86400000, // 24 hours
    604800000, // 7 days
  ];

  for (const delay of delays) {
    await metricsCollectorQueue.add(
      'collect',
      { postId, tenantId },
      { delay, jobId: `metrics-${postId}-${delay}` },
    );
  }
}
