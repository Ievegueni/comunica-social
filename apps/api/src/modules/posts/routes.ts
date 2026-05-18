import { FastifyInstance } from 'fastify';
import {
  createPostSchema,
  updatePostSchema,
  listPostsQuerySchema,
  calendarQuerySchema,
  rejectPostSchema,
} from './schemas.js';
import * as postsService from './service.js';
import { AppError } from '../../lib/errors.js';

export async function postsRoutes(app: FastifyInstance) {
  app.post(
    '/posts',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'EDITOR')],
    },
    async (request, reply) => {
      const parsed = createPostSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Validation failed', details: parsed.error.flatten() });
      }

      try {
        const post = await postsService.createPost(request.tenantId, request.userId, parsed.data);
        return reply.status(201).send(post);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  app.get(
    '/posts',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const parsed = listPostsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query params' });
      }

      const result = await postsService.listPosts(request.tenantId, parsed.data);
      return reply.send(result);
    },
  );

  app.get(
    '/posts/calendar',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const parsed = calendarQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query params' });
      }

      const posts = await postsService.getCalendarPosts(request.tenantId, parsed.data);
      return reply.send(posts);
    },
  );

  app.get(
    '/posts/:id',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const post = await postsService.getPost(request.tenantId, id);
        return reply.send(post);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  app.patch(
    '/posts/:id',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'EDITOR')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updatePostSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Validation failed', details: parsed.error.flatten() });
      }

      try {
        const post = await postsService.updatePost(
          request.tenantId,
          id,
          request.userId,
          parsed.data,
        );
        return reply.send(post);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  app.delete(
    '/posts/:id',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'EDITOR')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await postsService.deletePost(request.tenantId, id, request.userId);
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  app.post(
    '/posts/:id/duplicate',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'EDITOR')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const post = await postsService.duplicatePost(request.tenantId, id, request.userId);
        return reply.status(201).send(post);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  app.post(
    '/posts/:id/publish-now',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'EDITOR')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await postsService.publishNow(request.tenantId, id, request.userId);
        return reply.send(result);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  app.post(
    '/posts/:id/cancel',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'EDITOR')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await postsService.cancelPost(request.tenantId, id, request.userId);
        return reply.send(result);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  app.post(
    '/posts/:id/approve',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'APPROVER')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const post = await postsService.approvePost(request.tenantId, id, request.userId);
        return reply.send(post);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  app.post(
    '/posts/:id/reject',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'APPROVER')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = rejectPostSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Reason is required' });
      }

      try {
        const post = await postsService.rejectPost(
          request.tenantId,
          id,
          request.userId,
          parsed.data.reason,
        );
        return reply.send(post);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );
}
