import { FastifyInstance } from 'fastify';
import { inviteUserSchema, acceptInviteSchema, updateUserSchema } from './schemas.js';
import * as usersService from './service.js';
import { AppError } from '../../lib/errors.js';

export async function usersRoutes(app: FastifyInstance) {
  // List users (authenticated, any role)
  app.get(
    '/users',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const users = await usersService.listUsers(request.tenantId);
      return reply.send(users);
    },
  );

  // Get single user
  app.get(
    '/users/:id',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const user = await usersService.getUser(request.tenantId, id);
        return reply.send(user);
      } catch (err) {
        if (err instanceof AppError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  // Invite user (OWNER, ADMIN only)
  app.post(
    '/users/invite',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN')],
    },
    async (request, reply) => {
      const parsed = inviteUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Validation failed', details: parsed.error.flatten() });
      }

      try {
        const user = await usersService.inviteUser(request.tenantId, request.userId, parsed.data);
        return reply.status(201).send(user);
      } catch (err) {
        if (err instanceof AppError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  // Accept invite (public)
  app.post('/users/accept-invite', async (request, reply) => {
    const parsed = acceptInviteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed' });
    }

    try {
      const user = await usersService.acceptInvite(parsed.data.token, parsed.data.password);
      return reply.status(200).send(user);
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  // Update user (OWNER, ADMIN only)
  app.patch(
    '/users/:id',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Validation failed', details: parsed.error.flatten() });
      }

      try {
        const user = await usersService.updateUser(
          request.tenantId,
          id,
          request.userId,
          parsed.data,
        );
        return reply.send(user);
      } catch (err) {
        if (err instanceof AppError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  // Delete user (OWNER, ADMIN only)
  app.delete(
    '/users/:id',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        await usersService.deleteUser(request.tenantId, id, request.userId);
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof AppError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );
}
