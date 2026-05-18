import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { aiGeneratorQueue } from '../../workers/ai-generator.js';
import { schedulePostJob } from '../../workers/post-publisher.js';
import { GenerateInput, AcceptJobInput } from './schemas.js';

const MAX_DAILY_GENERATIONS = 10;

export async function createGenerationJob(tenantId: string, userId: string, input: GenerateInput) {
  // Check tenant has AI enabled
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.aiGenerationEnabled) {
    throw new AppError(403, 'AI generation is not enabled for this tenant');
  }

  // Rate limit: max N generations per day
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = await prisma.aIGenerationJob.count({
    where: {
      tenantId,
      createdAt: { gte: today },
    },
  });

  if (todayCount >= MAX_DAILY_GENERATIONS) {
    throw new AppError(429, 'Daily AI generation limit reached');
  }

  const job = await prisma.aIGenerationJob.create({
    data: {
      tenantId,
      createdById: userId,
      briefing: input.briefing,
      tone: input.tone,
      count: input.count,
      status: 'PENDING',
    },
  });

  // Queue the job
  await aiGeneratorQueue.add('generate', {
    jobId: job.id,
    tenantId,
    briefing: input.briefing,
    tone: input.tone,
    count: input.count,
  });

  return job;
}

export async function getJob(tenantId: string, jobId: string) {
  const job = await prisma.aIGenerationJob.findFirst({
    where: { id: jobId, tenantId },
  });
  if (!job) throw new AppError(404, 'Job not found');
  return job;
}

export async function listJobs(tenantId: string) {
  return prisma.aIGenerationJob.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function acceptJob(
  tenantId: string,
  userId: string,
  jobId: string,
  input: AcceptJobInput,
) {
  const job = await prisma.aIGenerationJob.findFirst({
    where: { id: jobId, tenantId, status: 'COMPLETED' },
  });
  if (!job) throw new AppError(404, 'Completed job not found');

  const results = job.result as Array<{
    content: string;
    hashtags: string[];
    suggestedTime?: string;
  }>;
  if (!results || !Array.isArray(results)) {
    throw new AppError(400, 'Job has no valid results');
  }

  // Verify social account
  const account = await prisma.socialAccount.findFirst({
    where: { id: input.socialAccountId, tenantId, status: 'ACTIVE' },
  });
  if (!account) throw new AppError(404, 'Social account not found');

  // Select which posts to accept
  const indices =
    input.postIds && input.postIds.length > 0
      ? input.postIds.filter((i) => i < results.length)
      : results.map((_, i) => i);

  const startDate = input.startDate ? new Date(input.startDate) : new Date(Date.now() + 3600000);
  const intervalMs = input.intervalHours * 3600000;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const createdPosts = [];

  for (let idx = 0; idx < indices.length; idx++) {
    const postData = results[indices[idx]];
    const scheduledFor = new Date(startDate.getTime() + idx * intervalMs);

    // Combine content with hashtags
    const fullContent =
      account.platform === 'INSTAGRAM'
        ? `${postData.content}\n\n${postData.hashtags.map((h) => `#${h}`).join(' ')}`
        : postData.content;

    // Check IG limit
    if (account.platform === 'INSTAGRAM' && fullContent.length > 2200) {
      continue; // Skip posts that are too long
    }

    let status: 'DRAFT' | 'PENDING_APPROVAL' | 'SCHEDULED' = 'DRAFT';
    if (scheduledFor > new Date()) {
      status = tenant?.approvalRequired ? 'PENDING_APPROVAL' : 'SCHEDULED';
    }

    const post = await prisma.post.create({
      data: {
        tenantId,
        socialAccountId: input.socialAccountId,
        createdById: userId,
        content: fullContent,
        scheduledFor,
        status,
        source: 'AI_GENERATED',
      },
    });

    if (status === 'SCHEDULED') {
      await schedulePostJob(post.id, tenantId, scheduledFor);
    }

    createdPosts.push(post);
  }

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'AI_POSTS_ACCEPTED',
      entityType: 'AIGenerationJob',
      entityId: jobId,
      metadata: { postsCreated: createdPosts.length },
    },
  });

  return { postsCreated: createdPosts.length, posts: createdPosts };
}
