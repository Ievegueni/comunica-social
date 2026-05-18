import { z } from 'zod';

export const listInboxQuerySchema = z.object({
  type: z.enum(['COMMENT_FB', 'COMMENT_IG', 'DM_MESSENGER', 'DM_INSTAGRAM']).optional(),
  status: z.enum(['UNREAD', 'READ', 'REPLIED', 'ARCHIVED']).optional(),
  socialAccountId: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(30),
});

export const replySchema = z.object({
  content: z.string().min(1).max(2000),
});

export const updateStatusSchema = z.object({
  status: z.enum(['READ', 'ARCHIVED']),
});

export type ListInboxQuery = z.infer<typeof listInboxQuerySchema>;
export type ReplyInput = z.infer<typeof replySchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
