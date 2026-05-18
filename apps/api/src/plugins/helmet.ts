import helmet from '@fastify/helmet';
import { FastifyInstance } from 'fastify';

export async function registerHelmet(app: FastifyInstance) {
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });
}
