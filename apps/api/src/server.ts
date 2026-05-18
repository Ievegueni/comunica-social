import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { registerCors } from './plugins/cors.js';
import { registerHelmet } from './plugins/helmet.js';
import { registerRateLimit } from './plugins/rate-limit.js';
import { registerJwt } from './plugins/jwt.js';
import authPlugin from './plugins/auth.js';
import { healthRoutes } from './modules/health/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { usersRoutes } from './modules/users/routes.js';
import { socialAccountsRoutes } from './modules/social-accounts/routes.js';
import { mediaRoutes } from './modules/media/routes.js';
import { postsRoutes } from './modules/posts/routes.js';
import { aiRoutes } from './modules/ai/routes.js';
import { inboxRoutes } from './modules/inbox/routes.js';
import { webhooksRoutes } from './modules/webhooks/routes.js';
import { analyticsRoutes } from './modules/analytics/routes.js';
import { adminRoutes } from './modules/admin/routes.js';
import { startTokenRefresherWorker, scheduleTokenRefresh } from './workers/token-refresher.js';
import { startPostPublisherWorker } from './workers/post-publisher.js';
import { startAIGeneratorWorker } from './workers/ai-generator.js';
import { startWebhookProcessorWorker } from './workers/webhook-processor.js';
import { startMetricsCollectorWorker } from './workers/metrics-collector.js';

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
});

// Global error handler
app.setErrorHandler((error: { statusCode?: number; message?: string }, request, reply) => {
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) {
    app.log.error(
      { err: error, url: request.url, method: request.method },
      'Internal server error',
    );
  }
  reply.status(statusCode).send({
    error: statusCode >= 500 ? 'Internal server error' : error.message || 'Error',
  });
});

// Plugins
await registerCors(app);
await registerHelmet(app);
await registerRateLimit(app);
await registerJwt(app);
await app.register(authPlugin);
await app.register(multipart, { limits: { fileSize: 200 * 1024 * 1024 } }); // 200MB max

// Routes
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(usersRoutes);
await app.register(socialAccountsRoutes);
await app.register(mediaRoutes);
await app.register(postsRoutes);
await app.register(aiRoutes);
await app.register(inboxRoutes);
await app.register(webhooksRoutes);
await app.register(analyticsRoutes);
await app.register(adminRoutes);

// Workers
startTokenRefresherWorker();
startPostPublisherWorker();
startAIGeneratorWorker();
startWebhookProcessorWorker();
startMetricsCollectorWorker();
await scheduleTokenRefresh();

// Graceful shutdown
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

for (const signal of signals) {
  process.on(signal, async () => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    process.exit(0);
  });
}

// Start
try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info(`Server running on http://localhost:${env.PORT}`);
} catch (err) {
  logger.error(err);
  process.exit(1);
}
