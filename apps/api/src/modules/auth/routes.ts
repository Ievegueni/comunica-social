import { FastifyInstance } from 'fastify';
import {
  signupSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './schemas.js';
import * as authService from './service.js';
import { AppError } from '../../lib/errors.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/signup', async (request, reply) => {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    try {
      const result = await authService.signup(app, parsed.data);
      return reply.status(201).send(result);
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    try {
      const result = await authService.login(app, parsed.data);
      return reply.status(200).send(result);
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post('/auth/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed' });
    }

    try {
      const result = await authService.refresh(app, parsed.data.refreshToken);
      return reply.status(200).send(result);
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post('/auth/forgot-password', async (request, reply) => {
    const parsed = forgotPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed' });
    }

    await authService.forgotPassword(parsed.data.email);
    return reply.status(200).send({ message: 'If the email exists, a reset link was sent' });
  });

  app.post('/auth/reset-password', async (request, reply) => {
    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed' });
    }

    try {
      await authService.resetPassword(parsed.data.token, parsed.data.password);
      return reply.status(200).send({ message: 'Password reset successfully' });
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post(
    '/auth/logout',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      await authService.logout(request.userId);
      return reply.status(200).send({ message: 'Logged out' });
    },
  );
}
