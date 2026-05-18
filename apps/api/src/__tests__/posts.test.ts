import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPostSchema,
  updatePostSchema,
  listPostsQuerySchema,
  calendarQuerySchema,
} from '../modules/posts/schemas.js';

// ============ SCHEMA TESTS ============

describe('Post Schemas', () => {
  describe('createPostSchema', () => {
    const validInput = {
      socialAccountId: 'acc-123',
      content: 'Hello world! #test',
      scheduledFor: new Date(Date.now() + 3600000).toISOString(),
      mediaAssetIds: [],
    };

    it('should validate a correct post input', () => {
      const result = createPostSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept post with media assets', () => {
      const result = createPostSchema.safeParse({
        ...validInput,
        mediaAssetIds: ['media-1', 'media-2'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty content', () => {
      const result = createPostSchema.safeParse({
        ...validInput,
        content: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing socialAccountId', () => {
      const { socialAccountId: _, ...noAccount } = validInput;
      const result = createPostSchema.safeParse(noAccount);
      expect(result.success).toBe(false);
    });

    it('should accept AI_GENERATED source', () => {
      const result = createPostSchema.safeParse({
        ...validInput,
        source: 'AI_GENERATED',
      });
      expect(result.success).toBe(true);
    });

    it('should default source to MANUAL', () => {
      const result = createPostSchema.safeParse(validInput);
      if (result.success) {
        expect(result.data.source).toBe('MANUAL');
      }
    });
  });

  describe('updatePostSchema', () => {
    it('should accept partial updates', () => {
      const result = updatePostSchema.safeParse({ content: 'Updated text' });
      expect(result.success).toBe(true);
    });

    it('should accept scheduledFor update', () => {
      const result = updatePostSchema.safeParse({
        scheduledFor: new Date().toISOString(),
      });
      expect(result.success).toBe(true);
    });

    it('should accept media update', () => {
      const result = updatePostSchema.safeParse({
        mediaAssetIds: ['media-1'],
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty update (all optional)', () => {
      const result = updatePostSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('listPostsQuerySchema', () => {
    it('should provide defaults for page and limit', () => {
      const result = listPostsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should accept status filter', () => {
      const result = listPostsQuerySchema.safeParse({ status: 'PUBLISHED' });
      expect(result.success).toBe(true);
    });

    it('should accept date range filters', () => {
      const result = listPostsQuerySchema.safeParse({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-12-31T23:59:59.000Z',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('calendarQuerySchema', () => {
    it('should require from and to', () => {
      const result = calendarQuerySchema.safeParse({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-31T23:59:59.000Z',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing from', () => {
      const result = calendarQuerySchema.safeParse({ to: '2026-01-31' });
      expect(result.success).toBe(false);
    });
  });
});

// ============ SERVICE LOGIC TESTS ============

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    tenant: { findUnique: vi.fn() },
    socialAccount: { findFirst: vi.fn() },
    mediaAsset: { findMany: vi.fn() },
    post: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    postMedia: { deleteMany: vi.fn(), createMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((fns: unknown[]) => Promise.all(fns)),
  },
}));

vi.mock('../workers/post-publisher.js', () => ({
  schedulePostJob: vi.fn(),
  cancelPostJob: vi.fn(),
}));

vi.mock('../config/env.js', () => ({
  env: { NODE_ENV: 'test' },
}));

describe('Post Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPost', () => {
    it('should throw if social account not found', async () => {
      const { prisma } = await import('../lib/prisma.js');
      (prisma.socialAccount.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { createPost } = await import('../modules/posts/service.js');
      await expect(
        createPost('tenant-1', 'user-1', {
          socialAccountId: 'non-existent',
          content: 'Test post',
          scheduledFor: new Date(Date.now() + 3600000).toISOString(),
          mediaAssetIds: [],
          source: 'MANUAL',
        }),
      ).rejects.toThrow('Social account not found');
    });

    it('should throw if IG content exceeds 2200 chars', async () => {
      const { prisma } = await import('../lib/prisma.js');
      (prisma.socialAccount.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'acc-1',
        tenantId: 'tenant-1',
        platform: 'INSTAGRAM',
      });

      const { createPost } = await import('../modules/posts/service.js');
      await expect(
        createPost('tenant-1', 'user-1', {
          socialAccountId: 'acc-1',
          content: 'x'.repeat(2201),
          scheduledFor: new Date(Date.now() + 3600000).toISOString(),
          mediaAssetIds: [],
          source: 'MANUAL',
        }),
      ).rejects.toThrow('Instagram posts are limited to 2200 characters');
    });

    it('should throw if media assets not found', async () => {
      const { prisma } = await import('../lib/prisma.js');
      (prisma.socialAccount.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'acc-1',
        tenantId: 'tenant-1',
        platform: 'FACEBOOK',
      });
      (prisma.mediaAsset.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { createPost } = await import('../modules/posts/service.js');
      await expect(
        createPost('tenant-1', 'user-1', {
          socialAccountId: 'acc-1',
          content: 'Test',
          scheduledFor: new Date(Date.now() + 3600000).toISOString(),
          mediaAssetIds: ['non-existent'],
          source: 'MANUAL',
        }),
      ).rejects.toThrow('One or more media assets not found');
    });
  });

  describe('deletePost', () => {
    it('should throw if post not found', async () => {
      const { prisma } = await import('../lib/prisma.js');
      (prisma.post.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { deletePost } = await import('../modules/posts/service.js');
      await expect(deletePost('tenant-1', 'post-1', 'user-1')).rejects.toThrow('Post not found');
    });

    it('should throw if post is not in deletable status', async () => {
      const { prisma } = await import('../lib/prisma.js');
      (prisma.post.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'post-1',
        tenantId: 'tenant-1',
        status: 'PUBLISHED',
      });

      const { deletePost } = await import('../modules/posts/service.js');
      await expect(deletePost('tenant-1', 'post-1', 'user-1')).rejects.toThrow(
        'Can only delete posts in DRAFT or CANCELLED status',
      );
    });
  });

  describe('updatePost', () => {
    it('should throw if post not found', async () => {
      const { prisma } = await import('../lib/prisma.js');
      (prisma.post.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { updatePost } = await import('../modules/posts/service.js');
      await expect(updatePost('tenant-1', 'post-1', 'user-1', { content: 'new' })).rejects.toThrow(
        'Post not found',
      );
    });

    it('should throw if post is published', async () => {
      const { prisma } = await import('../lib/prisma.js');
      (prisma.post.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'post-1',
        tenantId: 'tenant-1',
        status: 'PUBLISHED',
      });

      const { updatePost } = await import('../modules/posts/service.js');
      await expect(updatePost('tenant-1', 'post-1', 'user-1', { content: 'new' })).rejects.toThrow(
        'Can only edit posts in DRAFT or SCHEDULED status',
      );
    });
  });

  describe('approvePost', () => {
    it('should throw if post is not pending approval', async () => {
      const { prisma } = await import('../lib/prisma.js');
      (prisma.post.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'post-1',
        tenantId: 'tenant-1',
        status: 'DRAFT',
      });

      const { approvePost } = await import('../modules/posts/service.js');
      await expect(approvePost('tenant-1', 'post-1', 'user-1')).rejects.toThrow(
        'Post is not pending approval',
      );
    });
  });

  describe('cancelPost', () => {
    it('should throw if post is not in cancellable status', async () => {
      const { prisma } = await import('../lib/prisma.js');
      (prisma.post.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'post-1',
        tenantId: 'tenant-1',
        status: 'PUBLISHED',
      });

      const { cancelPost } = await import('../modules/posts/service.js');
      await expect(cancelPost('tenant-1', 'post-1', 'user-1')).rejects.toThrow(
        'Can only cancel posts in SCHEDULED or FAILED status',
      );
    });
  });
});
