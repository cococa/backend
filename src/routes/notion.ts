import { Hono } from 'hono'
import { ok } from '../lib/api.js'

export const notionRoute = new Hono()

notionRoute.post('/bind-page', async (c) => {
  const body = await c.req.json()
  return c.json(
    ok({
      notionSource: {
        id: 'notion_src_demo',
        pageId: body.pageId,
        pageTitle: body.pageTitle || null,
        accessType: 'public-page'
      }
    })
  )
})

notionRoute.get('/sources', (c) => {
  return c.json(ok({ sources: [] }))
})
