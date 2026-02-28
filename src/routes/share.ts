import { Hono } from 'hono'
import { ok } from '../lib/api.js'

export const shareRoute = new Hono()

shareRoute.get('/:slug', (c) => {
  const slug = c.req.param('slug')
  return c.json(
    ok({
      publishedChart: {
        slug,
        title: 'Demo Shared Chart',
        description: 'Shared from Chartly',
        snapshotJson: {},
        publishedAt: new Date().toISOString()
      }
    })
  )
})
