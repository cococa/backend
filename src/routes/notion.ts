import { Hono } from 'hono'
import { z } from 'zod'
import { ok } from '../lib/api.js'
import { upsertNotionDataSource } from '../lib/data-sources.js'
import { requireUser } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'

export const notionRoute = new Hono()

const bindPageSchema = z.object({
  pageId: z.string().min(1),
  pageTitle: z.string().max(500).optional().nullable(),
  accessType: z.string().max(100).optional().nullable(),
  fieldSchemaJson: z.any().optional().nullable(),
  previewJson: z.any().optional().nullable()
})

notionRoute.post('/bind-page', async (c) => {
  const user = await requireUser(c)
  const body = await c.req.json().catch(() => null)
  const parsed = bindPageSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_NOTION_BIND_PAYLOAD',
          message: 'Invalid notion bind payload'
        }
      },
      422
    )
  }

  const dataSource = await upsertNotionDataSource({
    userId: user.id,
    pageId: parsed.data.pageId,
    pageTitle: parsed.data.pageTitle,
    accessType: parsed.data.accessType,
    fieldSchemaJson: parsed.data.fieldSchemaJson ?? null,
    previewJson: parsed.data.previewJson ?? null
  })

  return c.json(
    ok({
      dataSource
    })
  )
})

notionRoute.get('/sources', async (c) => {
  const user = await requireUser(c)

  const dataSources = await prisma.dataSource.findMany({
    where: {
      userId: user.id,
      type: 'NOTION',
      isDeleted: false
    },
    orderBy: {
      updatedAt: 'desc'
    }
  })

  return c.json(ok({ dataSources }))
})
