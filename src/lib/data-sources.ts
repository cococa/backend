import { DataSourceType } from '@prisma/client'
import { prisma } from './prisma.js'

type NotionSourceInput = {
  userId: string
  pageId: string
  pageTitle?: string | null
  accessType?: string | null
  fieldSchemaJson?: any
  previewJson?: any
}

export function buildNotionSourceJson(input: {
  pageId: string
  pageTitle?: string | null
  accessType?: string | null
}) {
  return {
    pageId: input.pageId,
    pageTitle: input.pageTitle ?? null,
    accessType: input.accessType ?? 'public-page'
  }
}

export async function findNotionDataSourceByPageId(userId: string, pageId: string) {
  const sources = await prisma.dataSource.findMany({
    where: {
      userId,
      type: DataSourceType.NOTION,
      isDeleted: false
    },
    orderBy: {
      updatedAt: 'desc'
    }
  })

  return (
    sources.find((source) => {
      const sourceJson = source.sourceJson as Record<string, unknown> | null
      return sourceJson?.pageId === pageId
    }) || null
  )
}

export async function upsertNotionDataSource(input: NotionSourceInput) {
  const existing = await findNotionDataSourceByPageId(input.userId, input.pageId)

  if (existing) {
    return prisma.dataSource.update({
      where: {
        id: existing.id
      },
      data: {
        name: input.pageTitle?.trim() || existing.name,
        sourceJson: buildNotionSourceJson({
          pageId: input.pageId,
          pageTitle: input.pageTitle,
          accessType: input.accessType
        }),
        ...(input.fieldSchemaJson !== undefined ? { fieldSchemaJson: input.fieldSchemaJson } : {}),
        ...(input.previewJson !== undefined ? { previewJson: input.previewJson } : {})
      }
    })
  }

  return prisma.dataSource.create({
    data: {
      userId: input.userId,
      type: DataSourceType.NOTION,
      name: input.pageTitle?.trim() || input.pageId,
      description: null,
      sourceJson: buildNotionSourceJson({
        pageId: input.pageId,
        pageTitle: input.pageTitle,
        accessType: input.accessType
      }),
      fieldSchemaJson: input.fieldSchemaJson ?? null,
      previewJson: input.previewJson ?? null
    }
  })
}
