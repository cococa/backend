# Backend Blueprint

This backend is a standalone `Hono on Vercel` project.

## Goal

Phase 1 supports:
- user management
- membership management
- chart project configuration management
- generalized data source management
- Notion page based publishing

For phase 1, only `NOTION` sources are shareable, and the minimal source identifier is a `pageId`.
Other source types such as `CSV_FILE` and `EXCEL_FILE` are modeled through the same `DataSource.sourceJson`
structure, so file storage paths and future third-party provider configs can be added without changing
the project table again.

## Runtime

- Framework: Hono
- Deployment: Vercel Serverless Functions
- ORM: Prisma
- Database: Postgres

## Route tree

```txt
backend/
  api/
    [[...route]].ts
  prisma/
    schema.prisma
  src/
    app.ts
    lib/
      api.ts
      auth.ts
      env.ts
      prisma.ts
    routes/
      me.ts
      projects.ts
      published.ts
      notion.ts
      billing.ts
      share.ts
```

## Current endpoints

- `GET /`
- `GET /api/me`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id`
- `DELETE /api/projects/:id`
- `POST /api/projects/:id/publish`
- `PATCH /api/published/:id`
- `POST /api/notion/bind-page`
- `GET /api/notion/sources`
- `GET /api/billing/membership`
- `GET /api/share/:slug`

## Data model direction

### `DataSource`

Unified data source definition table.

Key fields:

- `type`
- `name`
- `description`
- `sourceJson`
- `fieldSchemaJson`
- `previewJson`

Recommended `sourceJson` shapes:

```json
{
  "pageId": "notion-page-id"
}
```

```json
{
  "storageProvider": "supabase",
  "bucket": "chart-data",
  "path": "users/u1/ds_001/source.csv",
  "fileName": "sales.csv"
}
```

Recommended `fieldSchemaJson` shape:

```json
{
  "fields": [
    { "key": "id", "type": "number" },
    { "key": "name", "type": "string" }
  ]
}
```

This metadata is used for:

- field auto-mapping
- data type inference
- form generation
- stable schema display in UI

### `ChartProject`

Projects no longer carry source-specific fields such as `notionPageId`.
They reference a unified `dataSourceId` instead.

## Response contract

### Success

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found"
  }
}
```

## Next implementation steps

1. install dependencies
2. run `prisma generate`
3. connect auth provider
4. replace mock route data with prisma queries
5. add membership gates
6. add publish slug generation and snapshot persistence
