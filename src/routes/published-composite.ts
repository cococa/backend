import { Hono } from 'hono'
import { fail, ok } from '../lib/api.js'
import { requireUser } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'
import {
  isSharePasswordValid,
  normalizeSharePassword,
  validateSharePassword
} from '../lib/share-password.js'

export const publishedCompositeRoute = new Hono()

publishedCompositeRoute.patch('/:id', async c => {
  const user = await requireUser(c)
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  const existing = await prisma.publishedCompositeView.findFirst({
    where: {
      id,
      userId: user.id
    }
  })

  if (!existing) {
    fail('PUBLISHED_COMPOSITE_NOT_FOUND', 'Published composite view not found', 404)
  }

  const publishedCompositeView = await prisma.publishedCompositeView.update({
    where: { id },
    data: {
      ...(body?.title !== undefined ? { title: body.title || existing.title } : {}),
      ...(body?.description !== undefined ? { description: body.description || null } : {}),
      ...(body?.isPublic !== undefined ? { isPublic: Boolean(body.isPublic) } : {}),
      ...(body?.snapshotJson !== undefined ? { snapshotJson: body.snapshotJson } : {}),
      ...(body?.passwordHash !== undefined ? { passwordHash: body.passwordHash || null } : {})
    }
  })

  return c.json(ok({ publishedCompositeView }))
})

publishedCompositeRoute.get('/:id/public', async c => {
  const id = c.req.param('id')
  const sharePassword = normalizeSharePassword(c.req.query('password'))

  const publishedCompositeView =
    (await prisma.publishedCompositeView.findFirst({
      where: {
        id,
        isPublic: true
      }
    })) ||
    (await prisma.publishedCompositeView.findFirst({
      where: {
        compositeId: id,
        isPublic: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    }))

  if (!publishedCompositeView) {
    fail('PUBLISHED_COMPOSITE_NOT_FOUND', 'Published composite view not found', 404)
  }

  if (publishedCompositeView.passwordHash || publishedCompositeView.access === 'PASSWORD') {
    if (!sharePassword) {
      fail('PASSWORD_REQUIRED', 'This shared dashboard requires a password.', 401)
    }

    try {
      validateSharePassword(sharePassword)
    } catch (error: any) {
      fail('INVALID_PASSWORD', error?.message || 'Invalid password', 401)
    }

    if (
      !publishedCompositeView.passwordHash ||
      !isSharePasswordValid(sharePassword, publishedCompositeView.passwordHash)
    ) {
      fail('INVALID_PASSWORD', 'Incorrect password.', 401)
    }
  }

  return c.json(ok({ publishedCompositeView }))
})
