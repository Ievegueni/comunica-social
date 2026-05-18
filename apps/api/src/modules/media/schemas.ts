import { z } from 'zod';

export const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().optional(),
});

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().nullable().optional(),
});

export const updateAssetSchema = z.object({
  folderId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export const listAssetsQuerySchema = z.object({
  folderId: z.string().optional(),
  type: z.enum(['IMAGE', 'VIDEO']).optional(),
  tags: z.string().optional(), // comma-separated
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(30),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>;
