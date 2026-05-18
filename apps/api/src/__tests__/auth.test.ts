import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../modules/auth/schemas.js';

// ============ SCHEMA VALIDATION TESTS ============

describe('Auth Schemas', () => {
  describe('signupSchema', () => {
    it('should validate a correct signup input', () => {
      const result = signupSchema.safeParse({
        tenantName: 'Futurix',
        tenantSlug: 'futurix',
        country: 'AO',
        name: 'João Silva',
        email: 'joao@futurix.ao',
        password: 'securepass123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid tenant slug', () => {
      const result = signupSchema.safeParse({
        tenantName: 'Futurix',
        tenantSlug: 'Invalid Slug!',
        country: 'AO',
        name: 'João Silva',
        email: 'joao@futurix.ao',
        password: 'securepass123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid country code', () => {
      const result = signupSchema.safeParse({
        tenantName: 'Futurix',
        tenantSlug: 'futurix',
        country: 'BR',
        name: 'João Silva',
        email: 'joao@futurix.ao',
        password: 'securepass123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = signupSchema.safeParse({
        tenantName: 'Futurix',
        tenantSlug: 'futurix',
        country: 'AO',
        name: 'João Silva',
        email: 'joao@futurix.ao',
        password: '123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = signupSchema.safeParse({
        tenantName: 'Futurix',
        tenantSlug: 'futurix',
        country: 'AO',
        name: 'João Silva',
        email: 'not-an-email',
        password: 'securepass123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty tenant name', () => {
      const result = signupSchema.safeParse({
        tenantName: 'A',
        tenantSlug: 'futurix',
        country: 'AO',
        name: 'João Silva',
        email: 'joao@futurix.ao',
        password: 'securepass123',
      });
      expect(result.success).toBe(false);
    });

    it('should accept all PALOP country codes', () => {
      for (const country of ['AO', 'MZ', 'CV', 'ST', 'GW']) {
        const result = signupSchema.safeParse({
          tenantName: 'Test',
          tenantSlug: 'test',
          country,
          name: 'Test User',
          email: 'test@test.com',
          password: 'securepass123',
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('loginSchema', () => {
    it('should validate correct login input', () => {
      const result = loginSchema.safeParse({
        email: 'joao@futurix.ao',
        password: 'securepass123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'joao@futurix.ao',
        password: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'invalid',
        password: 'securepass123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should validate correct email', () => {
      const result = forgotPasswordSchema.safeParse({ email: 'test@test.com' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = forgotPasswordSchema.safeParse({ email: 'bad' });
      expect(result.success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('should validate correct reset input', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'abc123',
        password: 'newpassword123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject short password', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'abc123',
        password: '123',
      });
      expect(result.success).toBe(false);
    });
  });
});

// ============ SERVICE LOGIC TESTS (with mocks) ============

// Mock dependencies before importing service
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    tenant: { findUnique: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
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
  resetPasswordEmail: vi.fn().mockReturnValue({
    subject: 'Reset',
    html: '<p>Reset</p>',
    text: 'Reset',
  }),
}));

vi.mock('../config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:5173',
    JWT_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
  },
}));

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('forgotPassword', () => {
    it('should not throw when email does not exist', async () => {
      const { prisma } = await import('../lib/prisma.js');
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { forgotPassword } = await import('../modules/auth/service.js');
      await expect(forgotPassword('nonexistent@test.com')).resolves.not.toThrow();
    });
  });

  describe('resetPassword', () => {
    it('should throw on invalid token', async () => {
      const { redis } = await import('../lib/redis.js');
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { resetPassword } = await import('../modules/auth/service.js');
      await expect(resetPassword('invalid-token', 'newpass123')).rejects.toThrow(
        'Invalid or expired reset token',
      );
    });
  });

  describe('logout', () => {
    it('should delete refresh token from Redis', async () => {
      const { redis } = await import('../lib/redis.js');
      (redis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const { logout } = await import('../modules/auth/service.js');
      await logout('user-123');
      expect(redis.del).toHaveBeenCalledWith('refresh:user-123');
    });
  });
});
