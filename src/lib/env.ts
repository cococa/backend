import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  APP_URL: z.string().url().optional()
})

export const env = envSchema.safeParse(process.env)
