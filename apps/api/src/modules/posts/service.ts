import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { schedulePostJob, cancelPostJob } from '../../workers/post-publisher.js';
import { CreatePostInput, UpdatePostInput, ListPostsQuery, CalendarQuery } from './schemas.js';

export async function createPost(tenantId: string, userId: string, input: CreatePostInput) {
  // Verify social account belongs to tenant
  const account = await prisma.socialAccount.findFirst({
    where: { id: input.socialAccountId, tenantId },
  });
  if (!account) throw new AppError(404, 'Social account not found');

  // Verify media assets belong to tenant
  if (input.mediaAssetIds.length > 0) {
    const assets = await prisma.mediaAsset.findMany({
      where: { id: { in: input.mediaAssetIds }, tenantId },
    });
    if (assets.length !== input.mediaAssetIds.length) {
      throw new AppError(400, 'One or more media assets not found');
    }
  }

  // Check IG content limit
  if (account.platform === 'INSTAGRAM' && input.content.length > 2200) {
    throw new AppError(400, 'Instagram posts are limited to 2200 characters');
  }

  // Determine initial status
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  let status: 'DRAFT' | 'PENDING_APPROVAL' | 'SCHEDULED' = 'DRAFT';

  // If scheduled in the future and no approval needed, set as SCHEDULED
  const scheduledFor = new Date(input.scheduledFor);
  if (scheduledFor > new Date()) {
    if (tenant?.approvalRequired) {
      status = 'PENDING_APPROVAL';
    } else {
      status = 'SCHEDULED';
    }
  }

  const post = await prisma.post.create({
    data: {
      tenantId,
      socialAccountId: input.socialAccountId,
      createdById: userId,
      content: input.content,
      scheduledFor,
      status,
      source: input.source,
      media:
        input.mediaAssetIds.length > 0
          ? {
              create: input.mediaAssetIds.map((id, index) => ({
                mediaAssetId: id,
                order: index,
              })),
            }
          : undefined,
    },
    include: {
      socialAccount: { select: { id: true, platform: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      media: { include: { mediaAsset: true }, orderBy: { order: 'asc' } },
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'POST_CREATED',
      entityType: 'Post',
      entityId: post.id,
    },
  });

  // Schedule publish job if status is SCHEDULED
  if (status === 'SCHEDULED') {
    await schedulePostJob(post.id, tenantId, scheduledFor);
  }

  return post;
}

export async function getPost(tenantId: string, postId: string) {
  const post = await prisma.post.findFirst({
    where: { id: postId, tenantId },
    include: {
      socialAccount: { select: { id: true, platform: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      media: { include: { mediaAsset: true }, orderBy: { order: 'asc' } },
    },
  });
  if (!post) throw new AppError(404, 'Post not found');
  return post;
}

export async function listPosts(tenantId: string, query: ListPostsQuery) {
  const where: Prisma.PostWhereInput = { tenantId };

  if (query.status) where.status = query.status;
  if (query.socialAccountId) where.socialAccountId = query.socialAccountId;
  if (query.createdById) where.createdById = query.createdById;
  if (query.from || query.to) {
    where.scheduledFor = {};
    if (query.from) where.scheduledFor.gte = new Date(query.from);
    if (query.to) where.scheduledFor.lte = new Date(query.to);
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: {
        socialAccount: { select: { id: true, platform: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        media: { include: { mediaAsset: true }, orderBy: { order: 'asc' } },
      },
      orderBy: { scheduledFor: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.post.count({ where }),
  ]);

  return { posts, total, page: query.page, totalPages: Math.ceil(total / query.limit) };
}

export async function getCalendarPosts(tenantId: string, query: CalendarQuery) {
  const where: Prisma.PostWhereInput = {
    tenantId,
    scheduledFor: {
      gte: new Date(query.from),
      lte: new Date(query.to),
    },
  };

  if (query.status) where.status = query.status;
  if (query.socialAccountId) where.socialAccountId = query.socialAccountId;
  if (query.createdById) where.createdById = query.createdById;

  return prisma.post.findMany({
    where,
    select: {
      id: true,
      content: true,
      status: true,
      scheduledFor: true,
      publishedAt: true,
      source: true,
      socialAccount: { select: { id: true, platform: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      media: {
        include: { mediaAsset: { select: { thumbnailUrl: true, url: true } } },
        take: 1,
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { scheduledFor: 'asc' },
  });
}

export async function updatePost(
  tenantId: string,
  postId: string,
  userId: string,
  input: UpdatePostInput,
) {
  const post = await prisma.post.findFirst({ where: { id: postId, tenantId } });
  if (!post) throw new AppError(404, 'Post not found');

  if (!['DRAFT', 'SCHEDULED'].includes(post.status)) {
    throw new AppError(400, 'Can only edit posts in DRAFT or SCHEDULED status');
  }

  const data: Prisma.PostUpdateInput = { updatedAt: new Date() };
  if (input.content !== undefined) data.content = input.content;
  if (input.scheduledFor !== undefined) data.scheduledFor = new Date(input.scheduledFor);

  // Update media if provided
  if (input.mediaAssetIds !== undefined) {
    // Verify assets
    if (input.mediaAssetIds.length > 0) {
      const assets = await prisma.mediaAsset.findMany({
        where: { id: { in: input.mediaAssetIds }, tenantId },
      });
      if (assets.length !== input.mediaAssetIds.length) {
        throw new AppError(400, 'One or more media assets not found');
      }
    }

    // Delete existing and recreate atomically
    await prisma.$transaction([
      prisma.postMedia.deleteMany({ where: { postId } }),
      ...(input.mediaAssetIds.length > 0
        ? [
            prisma.postMedia.createMany({
              data: input.mediaAssetIds.map((id, index) => ({
                postId,
                mediaAssetId: id,
                order: index,
              })),
            }),
          ]
        : []),
    ]);
  }

  const updated = await prisma.post.update({
    where: { id: postId },
    data,
    include: {
      socialAccount: { select: { id: true, platform: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      media: { include: { mediaAsset: true }, orderBy: { order: 'asc' } },
    },
  });

  await prisma.auditLog.create({
    data: { tenantId, userId, action: 'POST_UPDATED', entityType: 'Post', entityId: postId },
  });

  // Reschedule job if scheduledFor changed and post is SCHEDULED
  if (input.scheduledFor && updated.status === 'SCHEDULED') {
    await schedulePostJob(postId, tenantId, new Date(input.scheduledFor));
  }

  return updated;
}

export async function deletePost(tenantId: string, postId: string, userId: string) {
  const post = await prisma.post.findFirst({ where: { id: postId, tenantId } });
  if (!post) throw new AppError(404, 'Post not found');

  if (!['DRAFT', 'CANCELLED'].includes(post.status)) {
    throw new AppError(400, 'Can only delete posts in DRAFT or CANCELLED status');
  }

  await prisma.post.delete({ where: { id: postId } });

  await prisma.auditLog.create({
    data: { tenantId, userId, action: 'POST_DELETED', entityType: 'Post', entityId: postId },
  });
}

export async function duplicatePost(tenantId: string, postId: string, userId: string) {
  const original = await prisma.post.findFirst({
    where: { id: postId, tenantId },
    include: { media: true },
  });
  if (!original) throw new AppError(404, 'Post not found');

  const duplicate = await prisma.post.create({
    data: {
      tenantId,
      socialAccountId: original.socialAccountId,
      createdById: userId,
      content: original.content,
      scheduledFor: new Date(Date.now() + 3600000), // 1 hour from now
      status: 'DRAFT',
      source: original.source,
      media:
        original.media.length > 0
          ? {
              create: original.media.map((m) => ({
                mediaAssetId: m.mediaAssetId,
                order: m.order,
              })),
            }
          : undefined,
    },
    include: {
      socialAccount: { select: { id: true, platform: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      media: { include: { mediaAsset: true }, orderBy: { order: 'asc' } },
    },
  });

  return duplicate;
}

export async function publishNow(tenantId: string, postId: string, userId: string) {
  const post = await prisma.post.findFirst({ where: { id: postId, tenantId } });
  if (!post) throw new AppError(404, 'Post not found');

  if (!['DRAFT', 'SCHEDULED', 'FAILED'].includes(post.status)) {
    throw new AppError(400, 'Can only publish posts in DRAFT, SCHEDULED, or FAILED status');
  }

  // Cancel any existing scheduled job
  await cancelPostJob(postId);

  // Update status and schedule immediately
  await prisma.post.update({
    where: { id: postId },
    data: { status: 'SCHEDULED', scheduledFor: new Date() },
  });

  await schedulePostJob(postId, tenantId, new Date());

  await prisma.auditLog.create({
    data: { tenantId, userId, action: 'POST_PUBLISH_NOW', entityType: 'Post', entityId: postId },
  });

  return { message: 'Post queued for immediate publishing' };
}

export async function cancelPost(tenantId: string, postId: string, userId: string) {
  const post = await prisma.post.findFirst({ where: { id: postId, tenantId } });
  if (!post) throw new AppError(404, 'Post not found');

  if (!['SCHEDULED', 'FAILED'].includes(post.status)) {
    throw new AppError(400, 'Can only cancel posts in SCHEDULED or FAILED status');
  }

  // Cancel the BullMQ job
  await cancelPostJob(postId);

  await prisma.post.update({
    where: { id: postId },
    data: { status: 'CANCELLED' },
  });

  await prisma.auditLog.create({
    data: { tenantId, userId, action: 'POST_CANCELLED', entityType: 'Post', entityId: postId },
  });

  return { message: 'Post cancelled' };
}

export async function approvePost(tenantId: string, postId: string, userId: string) {
  const post = await prisma.post.findFirst({ where: { id: postId, tenantId } });
  if (!post) throw new AppError(404, 'Post not found');

  if (post.status !== 'PENDING_APPROVAL') {
    throw new AppError(400, 'Post is not pending approval');
  }

  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      status: 'SCHEDULED',
      approvedById: userId,
      approvedAt: new Date(),
    },
    include: {
      socialAccount: { select: { id: true, platform: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      media: { include: { mediaAsset: true }, orderBy: { order: 'asc' } },
    },
  });

  // Schedule the publish job
  await schedulePostJob(postId, tenantId, post.scheduledFor);

  await prisma.auditLog.create({
    data: { tenantId, userId, action: 'POST_APPROVED', entityType: 'Post', entityId: postId },
  });

  return updated;
}

export async function rejectPost(tenantId: string, postId: string, userId: string, reason: string) {
  const post = await prisma.post.findFirst({ where: { id: postId, tenantId } });
  if (!post) throw new AppError(404, 'Post not found');

  if (post.status !== 'PENDING_APPROVAL') {
    throw new AppError(400, 'Post is not pending approval');
  }

  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      status: 'DRAFT',
      errorMessage: `Rejeitado: ${reason}`,
    },
    include: {
      socialAccount: { select: { id: true, platform: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      media: { include: { mediaAsset: true }, orderBy: { order: 'asc' } },
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'POST_REJECTED',
      entityType: 'Post',
      entityId: postId,
      metadata: { reason },
    },
  });

  return updated;
}
