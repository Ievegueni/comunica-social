import { FastifyInstance } from 'fastify';
import { listInboxQuerySchema, replySchema, updateStatusSchema } from './schemas.js';
import * as inboxService from './service.js';
import { AppError } from '../../lib/errors.js';

export async function inboxRoutes(app: FastifyInstance) {
  app.get(
    '/inbox',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const parsed = listInboxQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query params' });
      }

      const result = await inboxService.listInbox(request.tenantId, parsed.data);
      return reply.send(result);
    },
  );

  app.get(
    '/inbox/:id',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const item = await inboxService.getInboxItem(request.tenantId, id);
        return reply.send(item);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  app.post(
    '/inbox/:id/reply',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'EDITOR')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = replySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Content is required' });
      }

      try {
        const result = await inboxService.replyToItem(
          request.tenantId,
          id,
          request.userId,
          parsed.data,
        );
        return reply.status(201).send(result);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  app.patch(
    '/inbox/:id/status',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid status' });
      }

      try {
        const item = await inboxService.updateItemStatus(request.tenantId, id, parsed.data.status);
        return reply.send(item);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );
}
