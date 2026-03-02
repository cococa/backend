import { Prisma } from '@prisma/client'
import { Hono } from 'hono'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { fail, ok } from '../lib/api.js'
import { requireUser } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'
import {
  hashSharePassword,
  normalizeSharePassword,
  validateSharePassword
} from '../lib/share-password.js'

export const compositeViewsRoute = new Hono()

const jsonValueSchema: z.ZodTypeAny = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
)

const compositeViewSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  layoutJson: jsonValueSchema,
  themeJson: jsonValueSchema.optional().nullable()
})

const compositeViewUpdateSchema = compositeViewSchema.partial().refine(body => Object.keys(body).length > 0, {
  message: 'At least one field must be provided'
})

function normalizeNullable<T>(value: T | null | undefined) {
  return value ?? null
}

function toInputJsonValue(value: Prisma.JsonValue): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

function extractProjectIds(layoutJson: unknown): string[] {
  if (!layoutJson || typeof layoutJson !== 'object') {
    return []
  }

  const widgets = Array.isArray((layoutJson as any).widgets) ? (layoutJson as any).widgets : []

  return Array.from(
    new Set(
      widgets
        .map((widget: any) => widget?.sourceProjectId || widget?.projectId || null)
        .filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
    )
  )
}

async function buildCompositeSnapshot(userId: string, compositeView: {
  id: string
  name: string
  description: string | null
  layoutJson: Prisma.JsonValue
  themeJson: Prisma.JsonValue | null
}) {
  const layoutJson = compositeView.layoutJson as any
  const widgets = Array.isArray(layoutJson?.widgets) ? layoutJson.widgets : []
  const projectIds = extractProjectIds(layoutJson)

  const projects = projectIds.length
    ? await prisma.chartProject.findMany({
        where: {
          id: { in: projectIds },
          userId,
          isDeleted: false
        }
      })
    : []

  const projectMap = new Map(projects.map(project => [project.id, project]))

  const snapshotWidgets = widgets.map((widget: any) => {
    const sourceProjectId = widget?.sourceProjectId || widget?.projectId || null
    const project = sourceProjectId ? projectMap.get(sourceProjectId) : null

    return {
      id: widget?.id || `widget_${randomUUID()}`,
      x: Number(widget?.x ?? 0),
      y: Number(widget?.y ?? 0),
      w: Number(widget?.w ?? 4),
      h: Number(widget?.h ?? 4),
      title: widget?.title || project?.name || 'Untitled Chart',
      chartType: widget?.chartType || project?.chartType || 'common',
      projectId: sourceProjectId,
      chartConfig: project ? project.configJson : null
    }
  })

  return {
    version: 1,
    compositeId: compositeView.id,
    name: compositeView.name,
    description: compositeView.description,
    themeJson: compositeView.themeJson,
    widgets: snapshotWidgets
  }
}

compositeViewsRoute.get('/', async c => {
  const user = await requireUser(c)

  const compositeViews = await prisma.compositeView.findMany({
    where: {
      userId: user.id,
      isDeleted: false
    },
    orderBy: {
      updatedAt: 'desc'
    }
  })

  return c.json(ok({ compositeViews }))
})

compositeViewsRoute.post('/', async c => {
  const user = await requireUser(c)
  const body = await c.req.json().catch(() => null)
  const parsed = compositeViewSchema.safeParse(body)

  if (!parsed.success) {
    fail('INVALID_COMPOSITE_VIEW_PAYLOAD', 'Invalid composite view payload', 422)
  }

  const compositeView = await prisma.compositeView.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      description: normalizeNullable(parsed.data.description),
      layoutJson: parsed.data.layoutJson,
      themeJson: normalizeNullable(parsed.data.themeJson)
    }
  })

  return c.json(ok({ compositeView }))
})

compositeViewsRoute.get('/:id', async c => {
  const user = await requireUser(c)
  const id = c.req.param('id')

  const compositeView = await prisma.compositeView.findFirst({
    where: {
      id,
      userId: user.id,
      isDeleted: false
    }
  })

  if (!compositeView) {
    fail('COMPOSITE_VIEW_NOT_FOUND', 'Composite view not found', 404)
  }

  return c.json(ok({ compositeView }))
})

compositeViewsRoute.patch('/:id', async c => {
  const user = await requireUser(c)
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const parsed = compositeViewUpdateSchema.safeParse(body)

  if (!parsed.success) {
    fail('INVALID_COMPOSITE_VIEW_PAYLOAD', 'Invalid composite view payload', 422)
  }

  const existing = await prisma.compositeView.findFirst({
    where: {
      id,
      userId: user.id,
      isDeleted: false
    }
  })

  if (!existing) {
    fail('COMPOSITE_VIEW_NOT_FOUND', 'Composite view not found', 404)
  }

  const compositeView = await prisma.compositeView.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined
        ? { description: normalizeNullable(parsed.data.description) }
        : {}),
      ...(parsed.data.layoutJson !== undefined ? { layoutJson: parsed.data.layoutJson } : {}),
      ...(parsed.data.themeJson !== undefined
        ? { themeJson: normalizeNullable(parsed.data.themeJson) }
        : {})
    }
  })

  return c.json(ok({ compositeView }))
})

compositeViewsRoute.delete('/:id', async c => {
  const user = await requireUser(c)
  const id = c.req.param('id')

  const existing = await prisma.compositeView.findFirst({
    where: {
      id,
      userId: user.id,
      isDeleted: false
    }
  })

  if (!existing) {
    fail('COMPOSITE_VIEW_NOT_FOUND', 'Composite view not found', 404)
  }

  const compositeView = await prisma.compositeView.update({
    where: { id },
    data: { isDeleted: true }
  })

  return c.json(ok({ compositeView }))
})

compositeViewsRoute.post('/:id/publish', async c => {
  const user = await requireUser(c)
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  const compositeView = await prisma.compositeView.findFirst({
    where: {
      id,
      userId: user.id,
      isDeleted: false
    }
  })

  if (!compositeView) {
    fail('COMPOSITE_VIEW_NOT_FOUND', 'Composite view not found', 404)
  }

  const existing = await prisma.publishedCompositeView.findFirst({
    where: {
      compositeId: compositeView.id,
      userId: user.id
    },
    orderBy: {
      updatedAt: 'desc'
    }
  })

  const title =
    (typeof body?.title === 'string' && body.title.trim()) ||
    compositeView.name ||
    'Shared Dashboard'
  const description =
    typeof body?.description === 'string' && body.description.trim()
      ? body.description.trim()
      : null
  const isPublic = body?.isPublic !== undefined ? Boolean(body.isPublic) : true
  const sharePassword = normalizeSharePassword(body?.password)

  try {
    validateSharePassword(sharePassword)
  } catch (error: any) {
    fail('INVALID_SHARE_PASSWORD', error?.message || 'Invalid share password', 422)
  }

  const passwordHash = sharePassword ? hashSharePassword(sharePassword) : null
  const access = !isPublic ? 'PRIVATE' : passwordHash ? 'PASSWORD' : 'PUBLIC'
  const snapshotJson = await buildCompositeSnapshot(user.id, compositeView)

  const publishedCompositeView = existing
    ? await prisma.publishedCompositeView.update({
        where: { id: existing.id },
        data: {
          title,
          description,
          isPublic,
          access,
          passwordHash,
          snapshotJson: toInputJsonValue(snapshotJson),
          publishedAt: new Date()
        }
      })
    : await prisma.publishedCompositeView.create({
        data: {
          compositeId: compositeView.id,
          userId: user.id,
          slug: `dashboard-${randomUUID()}`,
          title,
          description,
          isPublic,
          access,
          passwordHash,
          snapshotJson: toInputJsonValue(snapshotJson),
          publishedAt: new Date()
        }
      })

  return c.json(
    ok({
      publishedCompositeView: {
        ...publishedCompositeView,
        shareUrl: `/chartly/composite-share?id=${publishedCompositeView.id}`
      }
    })
  )
})
