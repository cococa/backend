import { DataSourceType } from '@prisma/client'
import { Hono } from 'hono'
import { z } from 'zod'
import { fail, ok } from '../lib/api.js'
import { upsertNotionDataSource } from '../lib/data-sources.js'
import { requireUser } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'

export const dataSourcesRoute = new Hono()

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

const createDataSourceSchema = z.object({
  type: z.nativeEnum(DataSourceType),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  sourceJson: jsonValueSchema,
  fieldSchemaJson: jsonValueSchema.optional().nullable(),
  previewJson: jsonValueSchema.optional().nullable()
})

const updateDataSourceSchema = createDataSourceSchema
  .partial()
  .refine(body => Object.keys(body).length > 0, {
    message: 'At least one field must be provided'
  })

const upsertNotionSchema = z.object({
  pageId: z.string().min(1),
  pageTitle: z.string().max(500).optional().nullable(),
  accessType: z.string().max(100).optional().nullable(),
  fieldSchemaJson: jsonValueSchema.optional().nullable(),
  previewJson: jsonValueSchema.optional().nullable()
})

function normalizeNullable<T>(value: T | null | undefined) {
  return value ?? null
}

dataSourcesRoute.get('/', async c => {
  const user = await requireUser(c)
  const type = c.req.query('type')

  const dataSources = await prisma.dataSource.findMany({
    where: {
      userId: user.id,
      isDeleted: false,
      ...(type ? { type: type as DataSourceType } : {})
    },
    orderBy: {
      updatedAt: 'desc'
    }
  })

  return c.json(ok({ dataSources }))
})

dataSourcesRoute.post('/', async c => {
  const user = await requireUser(c)
  const body = await c.req.json().catch(() => null)
  const parsed = createDataSourceSchema.safeParse(body)

  if (!parsed.success) {
    fail('INVALID_DATA_SOURCE_PAYLOAD', 'Invalid data source payload', 422)
  }

  const dataSource = await prisma.dataSource.create({
    data: {
      userId: user.id,
      type: parsed.data.type,
      name: parsed.data.name,
      description: normalizeNullable(parsed.data.description),
      sourceJson: parsed.data.sourceJson,
      fieldSchemaJson: normalizeNullable(parsed.data.fieldSchemaJson),
      previewJson: normalizeNullable(parsed.data.previewJson)
    }
  })

  return c.json(ok({ dataSource }))
})

dataSourcesRoute.post('/upsert-notion', async c => {
  const user = await requireUser(c)
  const body = await c.req.json().catch(() => null)
  const parsed = upsertNotionSchema.safeParse(body)

  if (!parsed.success) {
    fail('INVALID_DATA_SOURCE_PAYLOAD', 'Invalid notion data source payload', 422)
  }

  const dataSource = await upsertNotionDataSource({
    userId: user.id,
    pageId: parsed.data.pageId,
    pageTitle: parsed.data.pageTitle,
    accessType: parsed.data.accessType,
    fieldSchemaJson: normalizeNullable(parsed.data.fieldSchemaJson),
    previewJson: normalizeNullable(parsed.data.previewJson)
  })

  return c.json(ok({ dataSource }))
})

dataSourcesRoute.get('/:id', async c => {
  const user = await requireUser(c)
  const id = c.req.param('id')

  const dataSource = await prisma.dataSource.findFirst({
    where: {
      id,
      userId: user.id,
      isDeleted: false
    }
  })

  if (!dataSource) {
    fail('DATA_SOURCE_NOT_FOUND', 'Data source not found', 404)
  }

  return c.json(ok({ dataSource }))
})

dataSourcesRoute.patch('/:id', async c => {
  const user = await requireUser(c)
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const parsed = updateDataSourceSchema.safeParse(body)

  if (!parsed.success) {
    fail('INVALID_DATA_SOURCE_PAYLOAD', 'Invalid data source payload', 422)
  }

  const existing = await prisma.dataSource.findFirst({
    where: {
      id,
      userId: user.id,
      isDeleted: false
    }
  })

  if (!existing) {
    fail('DATA_SOURCE_NOT_FOUND', 'Data source not found', 404)
  }

  const dataSource = await prisma.dataSource.update({
    where: { id },
    data: {
      ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined
        ? { description: normalizeNullable(parsed.data.description) }
        : {}),
      ...(parsed.data.sourceJson !== undefined ? { sourceJson: parsed.data.sourceJson } : {}),
      ...(parsed.data.fieldSchemaJson !== undefined
        ? { fieldSchemaJson: normalizeNullable(parsed.data.fieldSchemaJson) }
        : {}),
      ...(parsed.data.previewJson !== undefined
        ? { previewJson: normalizeNullable(parsed.data.previewJson) }
        : {})
    }
  })

  return c.json(ok({ dataSource }))
})

dataSourcesRoute.delete('/:id', async c => {
  const user = await requireUser(c)
  const id = c.req.param('id')

  const existing = await prisma.dataSource.findFirst({
    where: {
      id,
      userId: user.id,
      isDeleted: false
    }
  })

  if (!existing) {
    fail('DATA_SOURCE_NOT_FOUND', 'Data source not found', 404)
  }

  const dataSource = await prisma.dataSource.update({
    where: { id },
    data: {
      isDeleted: true
    }
  })

  return c.json(ok({ dataSource }))
})
