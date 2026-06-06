import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  PORT: z.string(),
  ENVIRONMENT: z.enum(['development', 'production', 'beta', 'staging']).default('development'),
  DATABASE_DIALECT: z.string(),
  DATABASE_HOST: z.string(),
  DATABASE_PORT: z.string(),
  DATABASE_NAME: z.string(),
  DATABASE_USERNAME: z.string(),
  DATABASE_PASSWORD: z.string(),
  SERVICE_CONNECTION_TIMEOUT: z.string(),
  REDIS_URL: z.string(),
  // Firebase Admin SDK — optional until Firebase account is created
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  // Infobip SMS
  INFOBIP_API_KEY: z.string(),
  INFOBIP_BASE_URL: z.string(),
  // Comma-separated list of allowed CORS origins e.g. https://app.twedot.com,https://admin.twedot.com
  // Leave unset in development to allow all origins
  ALLOWED_ORIGINS: z.string().optional(),
  // Admin panel key — required to access /api/v1/admin/* endpoints
  ADMIN_KEY: z.string().optional(),
})

const envSchemaValidation = envSchema.safeParse(process.env)

if (!envSchemaValidation.success) {
  console.log(envSchemaValidation.error.issues)
  process.exit(1)
}

export const env = envSchemaValidation.data
