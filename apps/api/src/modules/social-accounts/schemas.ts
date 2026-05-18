import { z } from 'zod';

export const metaCallbackSchema = z.object({
  code: z.string().min(1),
});

export const connectAccountSchema = z.object({
  platform: z.enum(['FACEBOOK', 'INSTAGRAM']),
  externalId: z.string().min(1),
  name: z.string().min(1),
  accessToken: z.string().min(1),
  pageId: z.string().optional(),
});

export type MetaCallbackInput = z.infer<typeof metaCallbackSchema>;
export type ConnectAccountInput = z.infer<typeof connectAccountSchema>;
