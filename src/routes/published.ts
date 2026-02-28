import { Hono } from 'hono'
import { ok } from '../lib/api'

export const publishedRoute = new Hono()

publishedRoute.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  return c.json(
    ok({
      publishedChart: {
        id,
        ...body,
        updatedAt: new Date().toISOString()
      }
    })
  )
})
