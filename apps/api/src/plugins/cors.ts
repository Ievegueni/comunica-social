import cors from '@fastify/cors';
import { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';

export async function registerCors(app: FastifyInstance) {
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        cb(null, true);
        return;
      }

      const allowed = [env.APP_URL, env.API_URL].filter(Boolean);

      if (allowed.some((url) => origin === url)) {
        cb(null, true);
        return;
      }

      // Allow localhost in development
      if (env.NODE_ENV !== 'production' && origin.includes('localhost')) {
        cb(null, true);
        return;
      }

      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}
