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
  dataSourceId: z.string().min(1).optional().nullable(),
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

function toInputJsonValue(value: Prisma.JsonValue): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

async function resolveProjectDataSource(userId: string, dataSourceId: string | null) {
  if (!dataSourceId) {
    return null
  }

  const dataSource = await prisma.dataSource.findFirst({
    where: {
      id: dataSourceId,
      userId,
      isDeleted: false
    }
  })

  if (!dataSource) {
    fail('DATA_SOURCE_NOT_FOUND', 'Data source not found', 404)
  }

  return dataSource
}

projectsRoute.get('/', async c => {
  const user = await requireUser(c)

  const projects = await prisma.chartProject.findMany({
    where: {
      userId: user.id,
      isDeleted: false
    },
    include: {
      dataSource: true
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

  const dataSourceId = normalizeNullable(parsed.data.dataSourceId)
  await resolveProjectDataSource(user.id, dataSourceId)

  const project = await prisma.chartProject.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      description: normalizeNullable(parsed.data.description),
      dataSourceId,
      chartType: parsed.data.chartType,
      configJson: parsed.data.configJson,
      themeJson: normalizeNullable(parsed.data.themeJson),
      publishOptionsJson: normalizeNullable(parsed.data.publishOptionsJson)
    },
    include: {
      dataSource: true
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
    },
    include: {
      dataSource: true
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

  let dataSourceId: string | null | undefined
  if (parsed.data.dataSourceId !== undefined) {
    dataSourceId = normalizeNullable(parsed.data.dataSourceId)
    await resolveProjectDataSource(user.id, dataSourceId)
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
      ...(parsed.data.dataSourceId !== undefined
        ? { dataSourceId }
        : {}),
      ...(parsed.data.chartType !== undefined ? { chartType: parsed.data.chartType } : {}),
      ...(parsed.data.configJson !== undefined ? { configJson: parsed.data.configJson } : {}),
      ...(parsed.data.themeJson !== undefined
        ? { themeJson: normalizeNullable(parsed.data.themeJson) }
        : {}),
      ...(parsed.data.publishOptionsJson !== undefined
        ? { publishOptionsJson: normalizeNullable(parsed.data.publishOptionsJson) }
        : {})
    },
    include: {
      dataSource: true
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
  const user = await requireUser(c)
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

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

  const existing = await prisma.publishedChart.findFirst({
    where: {
      projectId: project.id,
      userId: user.id
    },
    orderBy: {
      updatedAt: 'desc'
    }
  })

  const title =
    (typeof body?.title === 'string' && body.title.trim()) ||
    project.name ||
    'Shared Chart'
  const description =
    typeof body?.description === 'string' && body.description.trim() ? body.description.trim() : null
  const isPublic = body?.isPublic !== undefined ? Boolean(body.isPublic) : true
  const sharePassword = normalizeSharePassword(body?.password)

  try {
    validateSharePassword(sharePassword)
  } catch (error: any) {
    fail('INVALID_SHARE_PASSWORD', error?.message || 'Invalid share password', 422)
  }

  const passwordHash = sharePassword ? hashSharePassword(sharePassword) : null
  const access = !isPublic ? 'PRIVATE' : passwordHash ? 'PASSWORD' : 'PUBLIC'

  const publishedChart = existing
    ? await prisma.publishedChart.update({
        where: {
          id: existing.id
        },
        data: {
          title,
          description,
          isPublic,
          access,
          passwordHash,
          snapshotJson: toInputJsonValue(project.configJson),
          publishedAt: new Date()
        }
      })
    : await prisma.publishedChart.create({
        data: {
          projectId: project.id,
          userId: user.id,
          slug: `chart-${randomUUID()}`,
          title,
          description,
          isPublic,
          access,
          passwordHash,
          snapshotJson: toInputJsonValue(project.configJson),
          publishedAt: new Date()
        }
      })

  return c.json(
    ok({
      publishedChart: {
        ...publishedChart,
        shareUrl: `/chartly/online-preview?id=${publishedChart.id}`
      }
    })
  )
})
