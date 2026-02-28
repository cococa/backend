# Projects API

This document covers the configuration CRUD endpoints for chart projects.

Base URL:

- Production: `https://backend-z6vv.vercel.app`

Authentication:

- Cookie session: login through `/api/auth/login` and send `credentials: 'include'`
- Or Bearer token: `Authorization: Bearer <token>`

## Data model

Each project belongs to the current authenticated user and is soft deleted.

Important fields:

- `name`
- `description`
- `dataSourceId`
- `chartType`
- `configJson`
- `themeJson`
- `publishOptionsJson`

Each project can optionally bind to a unified `DataSource` record.
The data source stores:

- `type`
- `sourceJson`
- `fieldSchemaJson`
- `previewJson`

Recommended `fieldSchemaJson` shape:

```json
{
  "fields": [
    { "key": "id", "type": "number" },
    { "key": "name", "type": "string" }
  ]
}
```

## 1. Create project

`POST /api/projects`

### Request body

```json
{
  "name": "Weekly Revenue",
  "description": "Revenue chart from Notion page",
  "dataSourceId": "ds_notion_001",
  "chartType": "bar",
  "configJson": {
    "type": "common",
    "data": [
      {
        "id": "originData",
        "values": [
          { "month": "Jan", "value": 120 },
          { "month": "Feb", "value": 160 }
        ]
      }
    ],
    "series": [
      {
        "type": "bar",
        "dataId": "originData",
        "xField": "month",
        "yField": "value"
      }
    ]
  },
  "themeJson": null,
  "publishOptionsJson": null
}
```

### Response

```json
{
  "success": true,
  "data": {
    "project": {
      "id": "cm8xxxx",
      "userId": "cm8user",
      "dataSourceId": "ds_notion_001",
      "name": "Weekly Revenue",
      "description": "Revenue chart from Notion page",
      "chartType": "bar",
      "configJson": {},
      "themeJson": null,
      "publishOptionsJson": null,
      "isDeleted": false,
      "createdAt": "2026-02-28T10:00:00.000Z",
      "updatedAt": "2026-02-28T10:00:00.000Z",
      "dataSource": {
        "id": "ds_notion_001",
        "type": "NOTION",
        "name": "Revenue Source",
        "sourceJson": {
          "pageId": "1b0f1d11-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        },
        "fieldSchemaJson": {
          "fields": [
            { "key": "month", "type": "string" },
            { "key": "value", "type": "number" }
          ]
        }
      }
    }
  },
  "meta": {}
}
```

## 2. List projects

`GET /api/projects`

Returns current user projects ordered by `updatedAt desc`, excluding soft deleted records.
The response includes the bound `dataSource`.

### Response

```json
{
  "success": true,
  "data": {
    "projects": []
  },
  "meta": {}
}
```

## 3. Get project detail

`GET /api/projects/:id`

### Response

```json
{
  "success": true,
  "data": {
    "project": {}
  },
  "meta": {}
}
```

If the project does not belong to the current user or was deleted:

```json
{
  "success": false,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found"
  }
}
```

If the `dataSourceId` does not belong to the current user:

```json
{
  "success": false,
  "error": {
    "code": "DATA_SOURCE_NOT_FOUND",
    "message": "Data source not found"
  }
}
```

## 4. Update project

`PATCH /api/projects/:id`

Supports partial update. At least one field is required.

### Request body example

```json
{
  "name": "Weekly Revenue v2",
  "dataSourceId": "ds_csv_001",
  "chartType": "line",
  "themeJson": {
    "colorScheme": {
      "default": ["#1664FF", "#1AC6FF", "#FF8A00"]
    }
  }
}
```

### Response

```json
{
  "success": true,
  "data": {
    "project": {}
  },
  "meta": {}
}
```

## 5. Delete project

`DELETE /api/projects/:id`

This is a soft delete. The record remains in the database and `isDeleted` becomes `true`.

### Response

```json
{
  "success": true,
  "data": {
    "project": {
      "id": "cm8xxxx",
      "isDeleted": true
    }
  },
  "meta": {}
}
```

## Frontend examples

### Login first

```ts
await fetch('https://backend-z6vv.vercel.app/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify({
    email: 'demo@chartly.dev',
    password: 'Chartly123!'
  })
})
```

### Create project

```ts
await fetch('https://backend-z6vv.vercel.app/api/projects', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify({
    name: 'Weekly Revenue',
    dataSourceId: 'ds_notion_001',
    chartType: 'bar',
    configJson: {},
    themeJson: null,
    publishOptionsJson: null
  })
})
```

### Update project

```ts
await fetch(`https://backend-z6vv.vercel.app/api/projects/${projectId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify({
    configJson: nextConfig
  })
})
```

### Delete project

```ts
await fetch(`https://backend-z6vv.vercel.app/api/projects/${projectId}`, {
  method: 'DELETE',
  credentials: 'include'
})
```
