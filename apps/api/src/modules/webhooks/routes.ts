import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { webhookProcessorQueue } from '../../workers/webhook-processor.js';
import crypto from 'crypto';

const webhookPayloadSchema = z.object({
  object: z.string(),
  entry: z
    .array(
      z.object({
        id: z.string(),
        time: z.number(),
        changes: z
          .array(
            z.object({
              field: z.string(),
              value: z.record(z.unknown()),
            }),
          )
          .optional(),
        messaging: z.array(z.record(z.unknown())).optional(),
      }),
    )
    .optional(),
});

export async function webhooksRoutes(app: FastifyInstance) {
  // Meta webhook verification (GET)
  app.get(
    '/webhooks/meta',
    {
      config: { rawBody: true },
    },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const mode = query['hub.mode'];
      const token = query['hub.verify_token'];
      const challenge = query['hub.challenge'];

      if (mode === 'subscribe' && token === env.META_WEBHOOK_VERIFY_TOKEN) {
        logger.info('Meta webhook verified');
        return reply.status(200).send(challenge);
      }

      return reply.status(403).send('Forbidden');
    },
  );

  // Meta webhook events (POST)
  app.post(
    '/webhooks/meta',
    {
      config: { rawBody: true },
    },
    async (request, reply) => {
      // Verify signature (mandatory)
      const signature = request.headers['x-hub-signature-256'] as string;
      if (!signature) {
        logger.warn('Missing webhook signature header');
        return reply.status(401).send('Missing signature');
      }

      const body = JSON.stringify(request.body);
      const expectedSignature =
        'sha256=' +
        crypto
          .createHmac('sha256', env.META_APP_SECRET ?? '')
          .update(body)
          .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        logger.warn('Invalid webhook signature');
        return reply.status(401).send('Invalid signature');
      }

      const parsed = webhookPayloadSchema.safeParse(request.body);
      if (!parsed.success) {
        logger.warn({ errors: parsed.error.flatten() }, 'Invalid webhook payload');
        return reply.status(200).send('EVENT_RECEIVED'); // Still 200 to not trigger Meta retries
      }

      const payload = parsed.data;
      logger.info({ object: payload.object, entries: payload.entry?.length }, 'Webhook received');

      // Queue each entry for processing
      if (payload.entry) {
        for (const entry of payload.entry) {
          await webhookProcessorQueue.add('process', {
            object: payload.object,
            entry,
          });
        }
      }

      // Always respond 200 quickly to Meta
      return reply.status(200).send('EVENT_RECEIVED');
    },
  );
}
