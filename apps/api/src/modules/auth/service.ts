import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { FastifyInstance } from 'fastify';
import { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { AppError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { SignupInput, LoginInput } from './schemas.js';

const SALT_ROUNDS = 12;
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
const RESET_TOKEN_EXPIRY = 60 * 60; // 1 hour

export async function signup(app: FastifyInstance, input: SignupInput) {
  const existingTenant = await prisma.tenant.findUnique({ where: { slug: input.tenantSlug } });
  if (existingTenant) {
    throw new AppError(409, 'Tenant slug already exists');
  }

  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) {
    throw new AppError(409, 'Email already registered');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const tenant = await prisma.tenant.create({
    data: {
      name: input.tenantName,
      slug: input.tenantSlug,
      country: input.country,
    },
  });

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: input.email,
      passwordHash,
      name: input.name,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      action: 'TENANT_CREATED',
      entityType: 'Tenant',
      entityId: tenant.id,
    },
  });

  const tokens = generateTokens(app, user.id, tenant.id, user.role);
  await storeRefreshToken(user.id, tokens.refreshToken);

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    ...tokens,
  };
}

export async function login(app: FastifyInstance, input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { tenant: true },
  });

  if (!user || user.status !== 'ACTIVE') {
    throw new AppError(401, 'Invalid credentials');
  }

  const validPassword = await bcrypt.compare(input.password, user.passwordHash);
  if (!validPassword) {
    throw new AppError(401, 'Invalid credentials');
  }

  if (user.tenant.status !== 'ACTIVE') {
    throw new AppError(403, 'Tenant suspended');
  }

  const tokens = generateTokens(app, user.id, user.tenantId, user.role);
  await storeRefreshToken(user.id, tokens.refreshToken);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
    },
    tenant: { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug },
    ...tokens,
  };
}

export async function refresh(app: FastifyInstance, refreshToken: string) {
  let payload;
  try {
    payload = app.jwt.verify<{ sub: string; tenantId: string; role: string; type: string }>(
      refreshToken,
    );
  } catch {
    throw new AppError(401, 'Invalid refresh token');
  }

  if (payload.type !== 'refresh') {
    throw new AppError(401, 'Invalid token type');
  }

  const storedToken = await redis.get(`refresh:${payload.sub}`);
  if (storedToken !== refreshToken) {
    throw new AppError(401, 'Refresh token revoked');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { tenant: true },
  });

  if (!user || user.status !== 'ACTIVE' || user.tenant.status !== 'ACTIVE') {
    throw new AppError(401, 'User or tenant inactive');
  }

  const tokens = generateTokens(app, user.id, user.tenantId, user.role);
  await storeRefreshToken(user.id, tokens.refreshToken);

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    ...tokens,
  };
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Don't reveal if email exists
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  await redis.set(`reset:${token}`, user.id, 'EX', RESET_TOKEN_EXPIRY);

  // TODO: Send email with reset link (Sprint 1 - email integration)
  // For now, log the token in development
  if (env.NODE_ENV === 'development') {
    console.warn(`[DEV] Reset token for ${email}: ${token}`);
    console.warn(`[DEV] Reset URL: ${env.APP_URL}/reset-password?token=${token}`);
  }
}

export async function resetPassword(token: string, newPassword: string) {
  const userId = await redis.get(`reset:${token}`);
  if (!userId) {
    throw new AppError(400, 'Invalid or expired reset token');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  await redis.del(`reset:${token}`);
  await redis.del(`refresh:${userId}`);
}

export async function logout(userId: string) {
  await redis.del(`refresh:${userId}`);
}

function generateTokens(app: FastifyInstance, userId: string, tenantId: string, role: Role) {
  const accessToken = app.jwt.sign(
    { sub: userId, tenantId, role, type: 'access' as const },
    { expiresIn: '15m' },
  );

  const refreshToken = app.jwt.sign(
    { sub: userId, tenantId, role, type: 'refresh' as const },
    { expiresIn: '7d' },
  );

  return { accessToken, refreshToken };
}

async function storeRefreshToken(userId: string, token: string) {
  await redis.set(`refresh:${userId}`, token, 'EX', REFRESH_TOKEN_EXPIRY);
}
