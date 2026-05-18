import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_request, reply) => {
    const checks = { status: 'ok', db: 'ok', redis: 'ok' };

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      checks.db = 'error';
      checks.status = 'degraded';
    }

    try {
      await redis.ping();
    } catch {
      checks.redis = 'error';
      checks.status = 'degraded';
    }

    const statusCode = checks.status === 'ok' ? 200 : 503;
    return reply.status(statusCode).send(checks);
  });

  app.get('/ready', async (_request, reply) => {
    return reply.send({ status: 'ready' });
  });
}
