import jwt from '@fastify/jwt';
import { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';

export async function registerJwt(app: FastifyInstance) {
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: '15m',
    },
  });
}
