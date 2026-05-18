import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { Role } from '@prisma/client';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    tenantId: string;
    userRole: Role;
  }
}

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: Role;
  type: 'access' | 'refresh';
}

async function authPlugin(app: FastifyInstance) {
  app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const payload = await request.jwtVerify<JwtPayload>();
      if (payload.type !== 'access') {
        return reply.status(401).send({ error: 'Invalid token type' });
      }
      request.userId = payload.sub;
      request.tenantId = payload.tenantId;
      request.userRole = payload.role;
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  app.decorate('authorize', function (...roles: Role[]) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      await app.authenticate(request, reply);
      if (reply.sent) return;
      if (!roles.includes(request.userRole)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
    };
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (
      ...roles: Role[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(authPlugin, { name: 'auth', dependencies: ['@fastify/jwt'] });
