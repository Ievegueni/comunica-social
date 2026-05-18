import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  // Database (required)
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),

  // Auth (required)
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64), // 32 bytes hex

  // Meta (optional — features disabled until configured)
  META_APP_ID: z.string().min(1).optional(),
  META_APP_SECRET: z.string().min(1).optional(),
  META_REDIRECT_URI: z.string().url().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(1).optional(),

  // Cloudinary (optional — media upload disabled until configured)
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),

  // Anthropic (optional — AI generation disabled until configured)
  ANTHROPIC_API_KEY: z.string().min(1).optional(),

  // SMTP (optional — email disabled until configured)
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_FROM_NAME: z.string().default('COMUNICA Social'),
  SMTP_FROM_EMAIL: z.string().email().optional(),

  // App
  APP_URL: z.string().url(),
  API_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
