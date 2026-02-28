import { Hono } from 'hono'
import { ok } from '../lib/api.js'

export const notionRoute = new Hono()

notionRoute.post('/bind-page', async (c) => {
  const body = await c.req.json()
  return c.json(
    ok({
      dataSource: {
        id: 'notion_src_demo',
        type: 'NOTION',
        name: body.pageTitle || 'Notion Page',
        description: null,
        sourceJson: {
          pageId: body.pageId,
          pageTitle: body.pageTitle || null,
          accessType: 'public-page'
        },
        fieldSchemaJson: null,
        previewJson: null
      }
    })
  )
})

notionRoute.get('/sources', (c) => {
  return c.json(ok({ dataSources: [] }))
})
