import { Hono } from 'hono'
import { fail, ok } from '../lib/api.js'
import { prisma } from '../lib/prisma.js'

export const shareRoute = new Hono()

shareRoute.get('/:slug', async (c) => {
  const slug = c.req.param('slug')

  const publishedChart = await prisma.publishedChart.findFirst({
    where: {
      slug,
      isPublic: true
    }
  })

  if (!publishedChart) {
    fail('PUBLISHED_CHART_NOT_FOUND', 'Published chart not found', 404)
  }

  return c.json(ok({ publishedChart }))
})
