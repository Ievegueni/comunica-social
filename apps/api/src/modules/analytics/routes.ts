import { FastifyInstance } from 'fastify';
import * as analyticsService from './service.js';

export async function analyticsRoutes(app: FastifyInstance) {
  app.get(
    '/analytics/posts',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const result = await analyticsService.getPostsWithMetrics(request.tenantId, {
        socialAccountId: query.socialAccountId,
        from: query.from,
        to: query.to,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
      });
      return reply.send(result);
    },
  );

  app.get(
    '/analytics/posts/:id/history',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const metrics = await analyticsService.getPostMetricsHistory(request.tenantId, id);
      if (!metrics) return reply.status(404).send({ error: 'Post not found' });
      return reply.send(metrics);
    },
  );

  app.get(
    '/analytics/summary',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const summary = await analyticsService.getSummary(request.tenantId, query.from, query.to);
      return reply.send(summary);
    },
  );

  app.get(
    '/analytics/export.csv',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const csv = await analyticsService.exportCSV(request.tenantId, query.from, query.to);
      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename="analytics.csv"')
        .send(csv);
    },
  );
}
