import { z } from 'zod';

export const createPostSchema = z.object({
  socialAccountId: z.string().min(1),
  content: z.string().min(1).max(63206), // FB limit
  scheduledFor: z.string().datetime(),
  mediaAssetIds: z.array(z.string()).max(10).default([]),
  source: z.enum(['MANUAL', 'AI_GENERATED']).default('MANUAL'),
});

export const updatePostSchema = z.object({
  content: z.string().min(1).max(63206).optional(),
  scheduledFor: z.string().datetime().optional(),
  mediaAssetIds: z.array(z.string()).max(10).optional(),
});

export const listPostsQuerySchema = z.object({
  status: z
    .enum([
      'DRAFT',
      'PENDING_APPROVAL',
      'SCHEDULED',
      'PUBLISHING',
      'PUBLISHED',
      'FAILED',
      'CANCELLED',
    ])
    .optional(),
  socialAccountId: z.string().optional(),
  createdById: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const rejectPostSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const calendarQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  socialAccountId: z.string().optional(),
  status: z
    .enum([
      'DRAFT',
      'PENDING_APPROVAL',
      'SCHEDULED',
      'PUBLISHING',
      'PUBLISHED',
      'FAILED',
      'CANCELLED',
    ])
    .optional(),
  createdById: z.string().optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
