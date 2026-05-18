import { z } from 'zod';

export const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(['ADMIN', 'EDITOR', 'APPROVER', 'VIEWER']),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['ADMIN', 'EDITOR', 'APPROVER', 'VIEWER']).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
