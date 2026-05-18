import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

interface AnalyticsQuery {
  socialAccountId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export async function getPostsWithMetrics(tenantId: string, query: AnalyticsQuery) {
  const where: Prisma.PostWhereInput = {
    tenantId,
    status: 'PUBLISHED',
  };

  if (query.socialAccountId) where.socialAccountId = query.socialAccountId;
  if (query.from || query.to) {
    where.publishedAt = {};
    if (query.from) where.publishedAt.gte = new Date(query.from);
    if (query.to) where.publishedAt.lte = new Date(query.to);
  }

  const page = query.page || 1;
  const limit = query.limit || 20;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: {
        socialAccount: { select: { id: true, platform: true, name: true } },
        metrics: { orderBy: { collectedAt: 'desc' }, take: 1 },
      },
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.post.count({ where }),
  ]);

  // Flatten latest metrics
  const results = posts.map((post) => ({
    id: post.id,
    content: post.content.slice(0, 100),
    publishedAt: post.publishedAt,
    platform: post.socialAccount.platform,
    accountName: post.socialAccount.name,
    metrics: post.metrics[0] || {
      reach: 0,
      impressions: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
    },
  }));

  return { posts: results, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getPostMetricsHistory(tenantId: string, postId: string) {
  const post = await prisma.post.findFirst({
    where: { id: postId, tenantId },
  });
  if (!post) return null;

  const metrics = await prisma.postMetric.findMany({
    where: { postId },
    orderBy: { collectedAt: 'asc' },
  });

  return metrics;
}

export async function getSummary(tenantId: string, from?: string, to?: string) {
  const where: Prisma.PostWhereInput = {
    tenantId,
    status: 'PUBLISHED',
  };

  if (from || to) {
    where.publishedAt = {};
    if (from) where.publishedAt.gte = new Date(from);
    if (to) where.publishedAt.lte = new Date(to);
  }

  const publishedPosts = await prisma.post.findMany({
    where,
    select: { id: true },
  });

  const postIds = publishedPosts.map((p) => p.id);

  if (postIds.length === 0) {
    return {
      totalPosts: 0,
      totalReach: 0,
      totalImpressions: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalSaves: 0,
    };
  }

  // Get latest metric per post and aggregate
  const latestMetrics = await prisma.$queryRaw<
    Array<{
      total_reach: bigint;
      total_impressions: bigint;
      total_likes: bigint;
      total_comments: bigint;
      total_shares: bigint;
      total_saves: bigint;
    }>
  >`
    SELECT
      COALESCE(SUM(m.reach), 0) as total_reach,
      COALESCE(SUM(m.impressions), 0) as total_impressions,
      COALESCE(SUM(m.likes), 0) as total_likes,
      COALESCE(SUM(m.comments), 0) as total_comments,
      COALESCE(SUM(m.shares), 0) as total_shares,
      COALESCE(SUM(m.saves), 0) as total_saves
    FROM "PostMetric" m
    INNER JOIN (
      SELECT "postId", MAX("collectedAt") as max_date
      FROM "PostMetric"
      WHERE "postId" = ANY(${postIds})
      GROUP BY "postId"
    ) latest ON m."postId" = latest."postId" AND m."collectedAt" = latest.max_date
  `;

  const totals = latestMetrics[0] || {
    total_reach: 0n,
    total_impressions: 0n,
    total_likes: 0n,
    total_comments: 0n,
    total_shares: 0n,
    total_saves: 0n,
  };

  return {
    totalPosts: postIds.length,
    totalReach: Number(totals.total_reach),
    totalImpressions: Number(totals.total_impressions),
    totalLikes: Number(totals.total_likes),
    totalComments: Number(totals.total_comments),
    totalShares: Number(totals.total_shares),
    totalSaves: Number(totals.total_saves),
  };
}

export async function exportCSV(tenantId: string, from?: string, to?: string): Promise<string> {
  const where: Prisma.PostWhereInput = {
    tenantId,
    status: 'PUBLISHED',
  };

  if (from || to) {
    where.publishedAt = {};
    if (from) where.publishedAt.gte = new Date(from);
    if (to) where.publishedAt.lte = new Date(to);
  }

  const posts = await prisma.post.findMany({
    where,
    include: {
      socialAccount: { select: { platform: true, name: true } },
      metrics: { orderBy: { collectedAt: 'desc' }, take: 1 },
    },
    orderBy: { publishedAt: 'desc' },
  });

  const header =
    'Post ID,Content,Platform,Account,Published At,Reach,Impressions,Likes,Comments,Shares,Saves';
  const rows = posts.map((post) => {
    const m = post.metrics[0] || {
      reach: 0,
      impressions: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
    };
    const content = post.content.replace(/"/g, '""').replace(/\n/g, ' ').slice(0, 200);
    return `"${post.id}","${content}","${post.socialAccount.platform}","${post.socialAccount.name}","${post.publishedAt?.toISOString() || ''}",${m.reach},${m.impressions},${m.likes},${m.comments},${m.shares},${m.saves}`;
  });

  return [header, ...rows].join('\n');
}
