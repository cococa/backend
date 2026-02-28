import { Hono } from 'hono'
import { SourceType } from '@prisma/client'
import { z } from 'zod'
import { fail, ok } from '../lib/api.js'
import { requireUser } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'

export const projectsRoute = new Hono()

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

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  sourceType: z.nativeEnum(SourceType).optional(),
  notionSourceId: z.string().min(1).optional().nullable(),
  notionPageId: z.string().min(1).optional().nullable(),
  chartType: z.string().min(1).max(100),
  configJson: jsonValueSchema,
  themeJson: jsonValueSchema.optional().nullable(),
  publishOptionsJson: jsonValueSchema.optional().nullable()
})

const updateProjectSchema = createProjectSchema
  .partial()
  .refine(body => Object.keys(body).length > 0, {
    message: 'At least one field must be provided'
  })

function normalizeNullable<T>(value: T | null | undefined) {
  return value ?? null
}

projectsRoute.get('/', async c => {
  const user = await requireUser(c)

  const projects = await prisma.chartProject.findMany({
    where: {
      userId: user.id,
      isDeleted: false
    },
    orderBy: {
      updatedAt: 'desc'
    }
  })

  return c.json(
    ok({
      projects
    })
  )
})

projectsRoute.post('/', async c => {
  const user = await requireUser(c)
  const body = await c.req.json().catch(() => null)
  const parsed = createProjectSchema.safeParse(body)

  if (!parsed.success) {
    fail('INVALID_PROJECT_PAYLOAD', 'Invalid project payload', 422)
  }

  const project = await prisma.chartProject.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      description: normalizeNullable(parsed.data.description),
      sourceType: parsed.data.sourceType || SourceType.NOTION,
      notionSourceId: normalizeNullable(parsed.data.notionSourceId),
      notionPageId: normalizeNullable(parsed.data.notionPageId),
      chartType: parsed.data.chartType,
      configJson: parsed.data.configJson,
      themeJson: normalizeNullable(parsed.data.themeJson),
      publishOptionsJson: normalizeNullable(parsed.data.publishOptionsJson)
    }
  })

  return c.json(
    ok({
      project
    })
  )
})

projectsRoute.get('/:id', async c => {
  const user = await requireUser(c)
  const id = c.req.param('id')

  const project = await prisma.chartProject.findFirst({
    where: {
      id,
      userId: user.id,
      isDeleted: false
    }
  })

  if (!project) {
    fail('PROJECT_NOT_FOUND', 'Project not found', 404)
  }

  return c.json(ok({ project }))
})

projectsRoute.patch('/:id', async c => {
  const user = await requireUser(c)
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const parsed = updateProjectSchema.safeParse(body)

  if (!parsed.success) {
    fail('INVALID_PROJECT_PAYLOAD', 'Invalid project payload', 422)
  }

  const existing = await prisma.chartProject.findFirst({
    where: {
      id,
      userId: user.id,
      isDeleted: false
    }
  })

  if (!existing) {
    fail('PROJECT_NOT_FOUND', 'Project not found', 404)
  }

  const project = await prisma.chartProject.update({
    where: {
      id
    },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined
        ? { description: normalizeNullable(parsed.data.description) }
        : {}),
      ...(parsed.data.sourceType !== undefined ? { sourceType: parsed.data.sourceType } : {}),
      ...(parsed.data.notionSourceId !== undefined
        ? { notionSourceId: normalizeNullable(parsed.data.notionSourceId) }
        : {}),
      ...(parsed.data.notionPageId !== undefined
        ? { notionPageId: normalizeNullable(parsed.data.notionPageId) }
        : {}),
      ...(parsed.data.chartType !== undefined ? { chartType: parsed.data.chartType } : {}),
      ...(parsed.data.configJson !== undefined ? { configJson: parsed.data.configJson } : {}),
      ...(parsed.data.themeJson !== undefined
        ? { themeJson: normalizeNullable(parsed.data.themeJson) }
        : {}),
      ...(parsed.data.publishOptionsJson !== undefined
        ? { publishOptionsJson: normalizeNullable(parsed.data.publishOptionsJson) }
        : {})
    }
  })

  return c.json(
    ok({
      project
    })
  )
})

projectsRoute.delete('/:id', async c => {
  const user = await requireUser(c)
  const id = c.req.param('id')

  const existing = await prisma.chartProject.findFirst({
    where: {
      id,
      userId: user.id,
      isDeleted: false
    }
  })

  if (!existing) {
    fail('PROJECT_NOT_FOUND', 'Project not found', 404)
  }

  const project = await prisma.chartProject.update({
    where: {
      id
    },
    data: {
      isDeleted: true
    }
  })

  return c.json(ok({ project }))
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
