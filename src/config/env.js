import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('*'),
  CLOUDFLARE_ORIGIN_SECRET: z.string().default('local-dev-origin-secret'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  UPSTASH_REDIS_URL: z.string().min(1, 'UPSTASH_REDIS_URL is required'),

  // Authentication
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long'),
  ACCESS_TOKEN_EXPIRES_IN: z.coerce.number().default(900), // 15 minutes
  REFRESH_TOKEN_EXPIRES_IN: z.coerce.number().default(604800), // 7 days

  // Google Cloud Storage
  GCP_PROJECT_ID: z.string().default('booking-dev-project'),
  GCS_BUCKET_PRIVATE: z.string().default('booking-dev-private-uploads'),
  GCS_BUCKET_PUBLIC: z.string().default('booking-dev-public-assets'),
  STORAGE_EMULATOR_HOST: z.string().optional(),

  // Email (Nodemailer)
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_SECURE: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  EMAIL_FROM: z.string().default('no-reply@booking.local')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables configuration:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;

