import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64), // 32 bytes hex

  // Meta
  META_APP_ID: z.string().min(1),
  META_APP_SECRET: z.string().min(1),
  META_REDIRECT_URI: z.string().url(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(1),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().min(1),

  // SMTP (Email)
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM_NAME: z.string().default('COMUNICA Social'),
  SMTP_FROM_EMAIL: z.string().email(),

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
