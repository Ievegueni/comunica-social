import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { z } from 'zod';

async function superAdminGuard(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const user = await prisma.user.findUnique({
    where: { id: request.userId },
    select: { isSuperAdmin: true },
  });

  if (!user?.isSuperAdmin) {
    return reply.status(403).send({ error: 'Super admin access required' });
  }
}

export async function adminRoutes(app: FastifyInstance) {
  // All routes require super admin
  app.addHook('onRequest', async (request, reply) => {
    await app.authenticate(request, reply);
    if (reply.sent) return;
    await superAdminGuard(request, reply);
  });

  // GET /admin/stats — Platform-wide statistics
  app.get('/admin/stats', async () => {
    const [tenants, users, posts, socialAccounts] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.post.count(),
      prisma.socialAccount.count({ where: { status: 'ACTIVE' } }),
    ]);

    const [activeTenants, suspendedTenants] = await Promise.all([
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
    ]);

    const recentTenants = await prisma.tenant.count({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    });

    return {
      tenants: {
        total: tenants,
        active: activeTenants,
        suspended: suspendedTenants,
        last30d: recentTenants,
      },
      users,
      posts,
      socialAccounts,
    };
  });

  // GET /admin/tenants — List all tenants
  app.get(
    '/admin/tenants',
    async (
      request: FastifyRequest<{
        Querystring: { page?: string; limit?: string; search?: string; status?: string };
      }>,
    ) => {
      const page = Math.max(1, parseInt(request.query.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '20', 10)));
      const skip = (page - 1) * limit;
      const search = request.query.search || '';
      const status = request.query.status;

      const where: Record<string, unknown> = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (status === 'ACTIVE' || status === 'SUSPENDED') {
        where.status = status;
      }

      const [tenants, total] = await Promise.all([
        prisma.tenant.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: { select: { users: true, posts: true, socialAccounts: true } },
          },
        }),
        prisma.tenant.count({ where }),
      ]);

      return { tenants, total, page, limit, pages: Math.ceil(total / limit) };
    },
  );

  // GET /admin/tenants/:id — Tenant detail
  app.get(
    '/admin/tenants/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: request.params.id },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              status: true,
              createdAt: true,
            },
          },
          _count: {
            select: { posts: true, socialAccounts: true, mediaAssets: true, inboxItems: true },
          },
        },
      });

      if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });
      return tenant;
    },
  );

  // PATCH /admin/tenants/:id — Update tenant (activate/suspend, toggle features)
  const updateTenantSchema = z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
    approvalRequired: z.boolean().optional(),
    aiGenerationEnabled: z.boolean().optional(),
  });

  app.patch(
    '/admin/tenants/:id',
    async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply) => {
      const parsed = updateTenantSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.status(400).send({ error: 'Invalid data', details: parsed.error.flatten() });

      const tenant = await prisma.tenant.findUnique({ where: { id: request.params.id } });
      if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });

      const updated = await prisma.tenant.update({
        where: { id: request.params.id },
        data: parsed.data,
      });

      return updated;
    },
  );

  // GET /admin/users — List all users across tenants
  app.get(
    '/admin/users',
    async (
      request: FastifyRequest<{ Querystring: { page?: string; limit?: string; search?: string } }>,
    ) => {
      const page = Math.max(1, parseInt(request.query.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '20', 10)));
      const skip = (page - 1) * limit;
      const search = request.query.search || '';

      const where: Record<string, unknown> = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            isSuperAdmin: true,
            createdAt: true,
            tenant: { select: { id: true, name: true, slug: true } },
          },
        }),
        prisma.user.count({ where }),
      ]);

      return { users, total, page, limit, pages: Math.ceil(total / limit) };
    },
  );
}
