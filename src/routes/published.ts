import { Hono } from 'hono'
import { fail, ok } from '../lib/api.js'
import { requireUser } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'
import {
  isSharePasswordValid,
  normalizeSharePassword,
  validateSharePassword
} from '../lib/share-password.js'

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
  const sharePassword = normalizeSharePassword(c.req.query('password'))

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

  if (publishedChart.passwordHash || publishedChart.access === 'PASSWORD') {
    if (!sharePassword) {
      fail('PASSWORD_REQUIRED', 'This shared chart requires a password.', 401)
    }

    try {
      validateSharePassword(sharePassword)
    } catch (error: any) {
      fail('INVALID_PASSWORD', error?.message || 'Invalid password', 401)
    }

    if (!publishedChart.passwordHash || !isSharePasswordValid(sharePassword, publishedChart.passwordHash)) {
      fail('INVALID_PASSWORD', 'Incorrect password.', 401)
    }
  }

  return c.json(
    ok({
      publishedChart
    })
  )
})
