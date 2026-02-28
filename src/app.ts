import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { meRoute } from './routes/me'
import { projectsRoute } from './routes/projects'
import { publishedRoute } from './routes/published'
import { notionRoute } from './routes/notion'
import { billingRoute } from './routes/billing'
import { shareRoute } from './routes/share'

export const app = new Hono()

app.get('/', (c) => {
  return c.json({
    success: true,
    service: 'chartly-backend',
    version: '0.1.0'
  })
})

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
