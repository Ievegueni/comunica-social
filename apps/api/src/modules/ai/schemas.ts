import { z } from 'zod';

export const generateSchema = z.object({
  briefing: z.string().min(10).max(2000),
  tone: z.string().min(1).max(100),
  count: z.number().int().min(1).max(20),
});

export const acceptJobSchema = z.object({
  postIds: z.array(z.number().int().min(0)).optional(), // indices to accept; if empty, accept all
  socialAccountId: z.string().min(1),
  startDate: z.string().datetime().optional(), // auto-schedule starting from this date
  intervalHours: z.number().int().min(1).max(168).default(24), // hours between posts
});

export type GenerateInput = z.infer<typeof generateSchema>;
export type AcceptJobInput = z.infer<typeof acceptJobSchema>;
