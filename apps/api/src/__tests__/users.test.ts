import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inviteUserSchema, updateUserSchema } from '../modules/users/schemas.js';

// ============ SCHEMA TESTS ============

describe('User Schemas', () => {
  describe('inviteUserSchema', () => {
    it('should validate a correct invite input', () => {
      const result = inviteUserSchema.safeParse({
        email: 'maria@test.com',
        name: 'Maria Santos',
        role: 'EDITOR',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = inviteUserSchema.safeParse({
        email: 'invalid',
        name: 'Maria Santos',
        role: 'EDITOR',
      });
      expect(result.success).toBe(false);
    });

    it('should reject OWNER role (cannot invite owners)', () => {
      const result = inviteUserSchema.safeParse({
        email: 'maria@test.com',
        name: 'Maria Santos',
        role: 'OWNER',
      });
      expect(result.success).toBe(false);
    });

    it('should accept all non-owner roles', () => {
      for (const role of ['ADMIN', 'EDITOR', 'APPROVER', 'VIEWER']) {
        const result = inviteUserSchema.safeParse({
          email: `test-${role}@test.com`,
          name: 'Test',
          role,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('updateUserSchema', () => {
    it('should accept role update', () => {
      const result = updateUserSchema.safeParse({ role: 'ADMIN' });
      expect(result.success).toBe(true);
    });

    it('should accept status update', () => {
      const result = updateUserSchema.safeParse({ status: 'DISABLED' });
      expect(result.success).toBe(true);
    });

    it('should accept name update', () => {
      const result = updateUserSchema.safeParse({ name: 'New Name' });
      expect(result.success).toBe(true);
    });

    it('should accept empty update (all optional)', () => {
      const result = updateUserSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

// ============ SERVICE LOGIC TESTS ============

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock('../lib/redis.js', () => ({
  redis: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../lib/email.js', () => ({
  sendEmail: vi.fn(),
  inviteUserEmail: vi.fn().mockReturnValue({
    subject: 'Invite',
    html: '<p>Invite</p>',
    text: 'Invite',
  }),
}));

vi.mock('../config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:5173',
  },
}));

describe('User Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('inviteUser', () => {
    it('should throw if email already registered', async () => {
      const { prisma } = await import('../lib/prisma.js');
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'existing',
        email: 'taken@test.com',
      });

      const { inviteUser } = await import('../modules/users/service.js');
      await expect(
        inviteUser('tenant-1', 'admin-1', {
          email: 'taken@test.com',
          name: 'Test',
          role: 'EDITOR',
        }),
      ).rejects.toThrow('Email already registered');
    });
  });

  describe('acceptInvite', () => {
    it('should throw on invalid token', async () => {
      const { redis } = await import('../lib/redis.js');
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { acceptInvite } = await import('../modules/users/service.js');
      await expect(acceptInvite('bad-token', 'password123')).rejects.toThrow(
        'Invalid or expired invite token',
      );
    });

    it('should throw if user not in INVITED status', async () => {
      const { redis } = await import('../lib/redis.js');
      const { prisma } = await import('../lib/prisma.js');
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue('user-1');
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        status: 'ACTIVE',
      });

      const { acceptInvite } = await import('../modules/users/service.js');
      await expect(acceptInvite('valid-token', 'password123')).rejects.toThrow('Invalid invite');
    });
  });

  describe('updateUser', () => {
    it('should throw if user not found', async () => {
      const { prisma } = await import('../lib/prisma.js');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { updateUser } = await import('../modules/users/service.js');
      await expect(
        updateUser('tenant-1', 'non-existent', 'admin-1', { name: 'New' }),
      ).rejects.toThrow('User not found');
    });

    it('should throw when trying to modify OWNER', async () => {
      const { prisma } = await import('../lib/prisma.js');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'owner-1',
        role: 'OWNER',
      });

      const { updateUser } = await import('../modules/users/service.js');
      await expect(
        updateUser('tenant-1', 'owner-1', 'admin-1', { role: 'EDITOR' }),
      ).rejects.toThrow('Cannot modify owner');
    });

    it('should throw when trying to disable yourself', async () => {
      const { prisma } = await import('../lib/prisma.js');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'admin-1',
        role: 'ADMIN',
      });

      const { updateUser } = await import('../modules/users/service.js');
      await expect(
        updateUser('tenant-1', 'admin-1', 'admin-1', { status: 'DISABLED' }),
      ).rejects.toThrow('Cannot disable yourself');
    });
  });

  describe('deleteUser', () => {
    it('should throw if user not found', async () => {
      const { prisma } = await import('../lib/prisma.js');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { deleteUser } = await import('../modules/users/service.js');
      await expect(deleteUser('tenant-1', 'non-existent', 'admin-1')).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw when trying to delete OWNER', async () => {
      const { prisma } = await import('../lib/prisma.js');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'owner-1',
        role: 'OWNER',
      });

      const { deleteUser } = await import('../modules/users/service.js');
      await expect(deleteUser('tenant-1', 'owner-1', 'admin-1')).rejects.toThrow(
        'Cannot delete owner',
      );
    });

    it('should throw when trying to delete yourself', async () => {
      const { prisma } = await import('../lib/prisma.js');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'admin-1',
        role: 'ADMIN',
      });

      const { deleteUser } = await import('../modules/users/service.js');
      await expect(deleteUser('tenant-1', 'admin-1', 'admin-1')).rejects.toThrow(
        'Cannot delete yourself',
      );
    });
  });
});
