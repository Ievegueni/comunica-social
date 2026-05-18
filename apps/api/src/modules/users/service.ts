import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { AppError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { InviteUserInput, UpdateUserInput } from './schemas.js';

const INVITE_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days
const SALT_ROUNDS = 12;

export async function listUsers(tenantId: string) {
  return prisma.user.findMany({
    where: { tenantId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getUser(tenantId: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  return user;
}

export async function inviteUser(tenantId: string, invitedById: string, input: InviteUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, 'Email already registered');
  }

  // Create user in INVITED status with placeholder password
  const user = await prisma.user.create({
    data: {
      tenantId,
      email: input.email,
      name: input.name,
      role: input.role,
      status: 'INVITED',
      passwordHash: '', // Will be set on accept
    },
  });

  // Generate invite token
  const token = crypto.randomBytes(32).toString('hex');
  await redis.set(`invite:${token}`, user.id, 'EX', INVITE_TOKEN_EXPIRY);

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: invitedById,
      action: 'USER_INVITED',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: input.email, role: input.role },
    },
  });

  // TODO: Send invite email
  if (env.NODE_ENV === 'development') {
    console.warn(`[DEV] Invite token for ${input.email}: ${token}`);
    console.warn(`[DEV] Invite URL: ${env.APP_URL}/invite?token=${token}`);
  }

  return { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status };
}

export async function acceptInvite(token: string, password: string) {
  const userId = await redis.get(`invite:${token}`);
  if (!userId) {
    throw new AppError(400, 'Invalid or expired invite token');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'INVITED') {
    throw new AppError(400, 'Invalid invite');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, status: 'ACTIVE' },
    select: { id: true, email: true, name: true, role: true, status: true },
  });

  await redis.del(`invite:${token}`);

  return updated;
}

export async function updateUser(
  tenantId: string,
  targetUserId: string,
  requesterId: string,
  input: UpdateUserInput,
) {
  const target = await prisma.user.findFirst({ where: { id: targetUserId, tenantId } });
  if (!target) {
    throw new AppError(404, 'User not found');
  }

  // Cannot change OWNER role
  if (target.role === 'OWNER') {
    throw new AppError(403, 'Cannot modify owner');
  }

  // Cannot disable yourself
  if (targetUserId === requesterId && input.status === 'DISABLED') {
    throw new AppError(400, 'Cannot disable yourself');
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: input,
    select: { id: true, email: true, name: true, role: true, status: true },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: requesterId,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: targetUserId,
      metadata: input,
    },
  });

  return updated;
}

export async function deleteUser(tenantId: string, targetUserId: string, requesterId: string) {
  const target = await prisma.user.findFirst({ where: { id: targetUserId, tenantId } });
  if (!target) {
    throw new AppError(404, 'User not found');
  }

  if (target.role === 'OWNER') {
    throw new AppError(403, 'Cannot delete owner');
  }

  if (targetUserId === requesterId) {
    throw new AppError(400, 'Cannot delete yourself');
  }

  await prisma.user.delete({ where: { id: targetUserId } });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: requesterId,
      action: 'USER_DELETED',
      entityType: 'User',
      entityId: targetUserId,
      metadata: { email: target.email },
    },
  });
}
