# Projects API

This document covers the real configuration CRUD endpoints for chart projects.

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
- `sourceType`
- `notionSourceId`
- `notionPageId`
- `chartType`
- `configJson`
- `themeJson`
- `publishOptionsJson`

## 1. Create project

`POST /api/projects`

### Request body

```json
{
  "name": "Weekly Revenue",
  "description": "Revenue chart from Notion page",
  "sourceType": "NOTION",
  "notionSourceId": null,
  "notionPageId": "1b0f1d11-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
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
      "name": "Weekly Revenue",
      "description": "Revenue chart from Notion page",
      "sourceType": "NOTION",
      "notionSourceId": null,
      "notionPageId": "1b0f1d11-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "chartType": "bar",
      "configJson": {},
      "themeJson": null,
      "publishOptionsJson": null,
      "isDeleted": false,
      "createdAt": "2026-02-28T10:00:00.000Z",
      "updatedAt": "2026-02-28T10:00:00.000Z"
    }
  },
  "meta": {}
}
```

## 2. List projects

`GET /api/projects`

Returns current user projects ordered by `updatedAt desc`, excluding soft deleted records.

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

## 4. Update project

`PATCH /api/projects/:id`

Supports partial update. At least one field is required.

### Request body example

```json
{
  "name": "Weekly Revenue v2",
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
    sourceType: 'NOTION',
    notionPageId: 'page_id_from_notion',
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
