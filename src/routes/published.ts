import { Hono } from 'hono'
import { fail, ok } from '../lib/api.js'
import { requireUser } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'

export const publishedRoute = new Hono()

publishedRoute.patch('/:id', async (c) => {
  const user = await requireUser(c)
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  const existing = await prisma.publishedChart.findFirst({
    where: {
      id,
      userId: user.id
    }
  })

  if (!existing) {
    fail('PUBLISHED_CHART_NOT_FOUND', 'Published chart not found', 404)
  }

  const publishedChart = await prisma.publishedChart.update({
    where: {
      id
    },
    data: {
      ...(body?.title !== undefined ? { title: body.title || existing.title } : {}),
      ...(body?.description !== undefined ? { description: body.description || null } : {}),
      ...(body?.isPublic !== undefined ? { isPublic: Boolean(body.isPublic) } : {}),
      ...(body?.snapshotJson !== undefined ? { snapshotJson: body.snapshotJson } : {}),
      ...(body?.passwordHash !== undefined ? { passwordHash: body.passwordHash || null } : {})
    }
  })

  return c.json(
    ok({
      publishedChart
    })
  )
})

publishedRoute.get('/:id/public', async c => {
  const id = c.req.param('id')

  const publishedChart =
    (await prisma.publishedChart.findFirst({
      where: {
        id,
        isPublic: true
      }
    })) ||
    (await prisma.publishedChart.findFirst({
      where: {
        projectId: id,
        isPublic: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    }))

  if (!publishedChart) {
    fail('PUBLISHED_CHART_NOT_FOUND', 'Published chart not found', 404)
  }

  return c.json(
    ok({
      publishedChart
    })
  )
})
