import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../lib/cloudinary.js';
import { AppError } from '../../lib/errors.js';
import {
  CreateFolderInput,
  UpdateFolderInput,
  UpdateAssetInput,
  ListAssetsQuery,
} from './schemas.js';

const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB

// ============ FOLDERS ============

export async function createFolder(tenantId: string, input: CreateFolderInput) {
  if (input.parentId) {
    const parent = await prisma.mediaFolder.findFirst({
      where: { id: input.parentId, tenantId },
    });
    if (!parent) throw new AppError(404, 'Parent folder not found');
  }

  return prisma.mediaFolder.create({
    data: { tenantId, name: input.name, parentId: input.parentId },
  });
}

export async function listFolders(tenantId: string) {
  return prisma.mediaFolder.findMany({
    where: { tenantId },
    include: { _count: { select: { assets: true, children: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function updateFolder(tenantId: string, folderId: string, input: UpdateFolderInput) {
  const folder = await prisma.mediaFolder.findFirst({ where: { id: folderId, tenantId } });
  if (!folder) throw new AppError(404, 'Folder not found');

  if (input.parentId === folderId) throw new AppError(400, 'Cannot set folder as its own parent');

  return prisma.mediaFolder.update({
    where: { id: folderId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.parentId !== undefined && { parentId: input.parentId }),
    },
  });
}

export async function deleteFolder(tenantId: string, folderId: string) {
  const folder = await prisma.mediaFolder.findFirst({
    where: { id: folderId, tenantId },
    include: { _count: { select: { assets: true, children: true } } },
  });
  if (!folder) throw new AppError(404, 'Folder not found');

  if (folder._count.assets > 0 || folder._count.children > 0) {
    throw new AppError(400, 'Folder is not empty');
  }

  await prisma.mediaFolder.delete({ where: { id: folderId } });
}

// ============ ASSETS ============

export async function uploadAsset(
  tenantId: string,
  file: { buffer: Buffer; filename: string; mimetype: string },
  folderId?: string,
) {
  const isVideo = file.mimetype.startsWith('video/');
  const isImage = file.mimetype.startsWith('image/');

  if (!isVideo && !isImage) {
    throw new AppError(400, 'Only images and videos are allowed');
  }

  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (file.buffer.length > maxSize) {
    throw new AppError(400, `File too large. Max ${isVideo ? '200MB' : '50MB'}`);
  }

  if (folderId) {
    const folder = await prisma.mediaFolder.findFirst({ where: { id: folderId, tenantId } });
    if (!folder) throw new AppError(404, 'Folder not found');
  }

  const resourceType = isVideo ? 'video' : 'image';
  const result = await uploadToCloudinary(file.buffer, {
    folder: `comunica/${tenantId}`,
    resourceType,
  });

  return prisma.mediaAsset.create({
    data: {
      tenantId,
      folderId: folderId || null,
      type: isVideo ? 'VIDEO' : 'IMAGE',
      cloudinaryId: result.publicId,
      url: result.url,
      thumbnailUrl: result.thumbnailUrl,
      filename: file.filename,
      sizeBytes: result.bytes,
      width: result.width,
      height: result.height,
      durationSec: result.duration ? Math.round(result.duration) : null,
      tags: [],
    },
  });
}

export async function listAssets(tenantId: string, query: ListAssetsQuery) {
  const where: Prisma.MediaAssetWhereInput = { tenantId };

  if (query.folderId) {
    where.folderId = query.folderId;
  }

  if (query.type) {
    where.type = query.type;
  }

  if (query.tags) {
    const tagList = query.tags.split(',').map((t) => t.trim());
    where.tags = { hasSome: tagList };
  }

  if (query.search) {
    where.filename = { contains: query.search, mode: 'insensitive' };
  }

  const [assets, total] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.mediaAsset.count({ where }),
  ]);

  return {
    assets,
    total,
    page: query.page,
    totalPages: Math.ceil(total / query.limit),
  };
}

export async function getAsset(tenantId: string, assetId: string) {
  const asset = await prisma.mediaAsset.findFirst({ where: { id: assetId, tenantId } });
  if (!asset) throw new AppError(404, 'Asset not found');
  return asset;
}

export async function updateAsset(tenantId: string, assetId: string, input: UpdateAssetInput) {
  const asset = await prisma.mediaAsset.findFirst({ where: { id: assetId, tenantId } });
  if (!asset) throw new AppError(404, 'Asset not found');

  if (input.folderId) {
    const folder = await prisma.mediaFolder.findFirst({ where: { id: input.folderId, tenantId } });
    if (!folder) throw new AppError(404, 'Folder not found');
  }

  return prisma.mediaAsset.update({
    where: { id: assetId },
    data: {
      ...(input.folderId !== undefined && { folderId: input.folderId }),
      ...(input.tags !== undefined && { tags: input.tags }),
    },
  });
}

export async function deleteAsset(tenantId: string, assetId: string) {
  const asset = await prisma.mediaAsset.findFirst({ where: { id: assetId, tenantId } });
  if (!asset) throw new AppError(404, 'Asset not found');

  await deleteFromCloudinary(asset.cloudinaryId, asset.type === 'VIDEO' ? 'video' : 'image');
  await prisma.mediaAsset.delete({ where: { id: assetId } });
}
