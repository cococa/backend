import { Hono } from 'hono'
import { ok } from '../lib/api'

export const projectsRoute = new Hono()

projectsRoute.get('/', (c) => {
  return c.json(ok({ projects: [] }))
})

projectsRoute.post('/', async (c) => {
  const body = await c.req.json()
  return c.json(
    ok({
      project: {
        id: 'proj_demo',
        ...body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })
  )
})

projectsRoute.get('/:id', (c) => {
  const id = c.req.param('id')
  return c.json(
    ok({
      project: {
        id,
        name: 'Demo Project',
        sourceType: 'NOTION',
        notionPageId: 'page_demo',
        chartType: 'bar',
        configJson: {},
        themeJson: {},
        publishOptionsJson: {}
      }
    })
  )
})

projectsRoute.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  return c.json(
    ok({
      project: {
        id,
        ...body,
        updatedAt: new Date().toISOString()
      }
    })
  )
})

projectsRoute.delete('/:id', (c) => {
  const id = c.req.param('id')
  return c.json(ok({ project: { id, isDeleted: true } }))
})

projectsRoute.post('/:id/publish', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  return c.json(
    ok({
      publishedChart: {
        id: 'pub_demo',
        projectId: id,
        slug: `project-${id}`,
        shareUrl: `/share/project-${id}`,
        ...body
      }
    })
  )
})
