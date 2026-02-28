# Backend Blueprint

This backend is a standalone `Hono on Vercel` project.

## Goal

Phase 1 supports:
- user management
- membership management
- chart project configuration management
- Notion page based publishing

For phase 1, only `NOTION` sources are shareable, and the minimal source identifier is a `pageId`.

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
