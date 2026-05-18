import { FastifyInstance } from 'fastify';
import { metaCallbackSchema, connectAccountSchema } from './schemas.js';
import * as socialService from './service.js';
import { AppError } from '../../lib/errors.js';
import { redis } from '../../lib/redis.js';
import crypto from 'crypto';

export async function socialAccountsRoutes(app: FastifyInstance) {
  // Get OAuth URL to start Meta connection
  app.get(
    '/social/meta/auth-url',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      // Generate state token to prevent CSRF
      const state = crypto.randomBytes(16).toString('hex');
      await redis.set(
        `meta_oauth:${state}`,
        JSON.stringify({
          userId: request.userId,
          tenantId: request.tenantId,
        }),
        'EX',
        600,
      ); // 10 minutes

      const url = socialService.getMetaOAuthUrl(state);
      return reply.send({ url, state });
    },
  );

  // Meta OAuth callback - exchange code for token and list available accounts
  app.post(
    '/social/meta/callback',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const parsed = metaCallbackSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Validation failed' });
      }

      try {
        const shortLivedToken = await socialService.exchangeCodeForToken(parsed.data.code);
        const accounts = await socialService.getAvailableAccounts(shortLivedToken);
        return reply.send({ accounts });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  // Connect a social account
  app.post(
    '/social-accounts',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN')],
    },
    async (request, reply) => {
      const parsed = connectAccountSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Validation failed', details: parsed.error.flatten() });
      }

      try {
        const account = await socialService.connectAccount(
          request.tenantId,
          request.userId,
          parsed.data,
        );
        return reply.status(201).send(account);
      } catch (err) {
        if (err instanceof AppError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  // List connected accounts
  app.get(
    '/social-accounts',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const accounts = await socialService.listAccounts(request.tenantId);
      return reply.send(accounts);
    },
  );

  // Disconnect account
  app.delete(
    '/social-accounts/:id',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        await socialService.disconnectAccount(request.tenantId, id, request.userId);
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
