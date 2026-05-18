import { FastifyInstance } from 'fastify';
import { generateSchema, acceptJobSchema } from './schemas.js';
import * as aiService from './service.js';
import { AppError } from '../../lib/errors.js';

export async function aiRoutes(app: FastifyInstance) {
  app.post(
    '/ai/generate',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'EDITOR')],
    },
    async (request, reply) => {
      const parsed = generateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Validation failed', details: parsed.error.flatten() });
      }

      try {
        const job = await aiService.createGenerationJob(
          request.tenantId,
          request.userId,
          parsed.data,
        );
        return reply.status(202).send(job);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  app.get(
    '/ai/jobs',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'EDITOR')],
    },
    async (request, reply) => {
      const jobs = await aiService.listJobs(request.tenantId);
      return reply.send(jobs);
    },
  );

  app.get(
    '/ai/jobs/:id',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'EDITOR')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const job = await aiService.getJob(request.tenantId, id);
        return reply.send(job);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  app.post(
    '/ai/jobs/:id/accept',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'EDITOR')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = acceptJobSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Validation failed', details: parsed.error.flatten() });
      }

      try {
        const result = await aiService.acceptJob(request.tenantId, request.userId, id, parsed.data);
        return reply.send(result);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );
}
