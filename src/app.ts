import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { authRoute } from './routes/auth.js'
import { meRoute } from './routes/me.js'
import { projectsRoute } from './routes/projects.js'
import { publishedRoute } from './routes/published.js'
import { notionRoute } from './routes/notion.js'
import { billingRoute } from './routes/billing.js'
import { shareRoute } from './routes/share.js'

const app = new Hono()

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost:5173'
]

const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

const allowedOrigins = new Set([...defaultAllowedOrigins, ...configuredOrigins])

app.use(
  '/api/*',
  cors({
    origin: origin => {
      if (!origin) {
        return ''
      }

      return allowedOrigins.has(origin) ? origin : ''
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400
  })
)

app.get('/', c => {
  return c.json({
    success: true,
    service: 'chartly-backend',
    version: '0.1.0'
  })
})

app.get('/api', c => {
  return c.json({
    success: true,
    service: 'chartly-backend',
    scope: 'api',
    version: '0.1.0'
  })
})

app.get('/api/health', c => {
  return c.json({
    success: true,
    status: 'ok',
    service: 'chartly-backend',
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  })
})

app.get('/debug/env', c => {
  const databaseUrl = process.env.DATABASE_URL || ''
  const authSecret = process.env.AUTH_SECRET || ''

  return c.json({
    success: true,
    data: {
      hasDatabaseUrl: Boolean(databaseUrl),
      databaseUrlPreview: databaseUrl ? `${databaseUrl.slice(0, 24)}...` : null,
      hasAuthSecret: Boolean(authSecret),
      authSecretLength: authSecret.length
    }
  })
})

app.route('/api/auth', authRoute)
app.route('/api/me', meRoute)
app.route('/api/projects', projectsRoute)
app.route('/api/published', publishedRoute)
app.route('/api/notion', notionRoute)
app.route('/api/billing', billingRoute)
app.route('/api/share', shareRoute)

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    const cause = error.cause as any
    return c.json(
      cause || {
        success: false,
        error: {
          code: 'HTTP_EXCEPTION',
          message: error.message
        }
      },
      error.status
    )
  }

  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message || 'Internal Server Error'
      }
    },
    500
  )
})

export { app }
export default app
