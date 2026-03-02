# Composite Views API

Base URL:

`https://backend-z6vv.vercel.app`

All edit routes require login and cookie credentials.

## Composite View

### GET `/api/composite-views`

Returns current user's composite views.

### POST `/api/composite-views`

Create a composite view.

Request body:

```json
{
  "name": "运营总览",
  "description": "首页组合视图",
  "layoutJson": {
    "version": 1,
    "widgets": [
      {
        "id": "widget_1",
        "sourceProjectId": "c_project_id",
        "sourceLocalId": null,
        "name": "销售趋势",
        "chartType": "line",
        "x": 0,
        "y": 0,
        "w": 4,
        "h": 4
      }
    ]
  },
  "themeJson": {
    "mode": "auto"
  }
}
```

### GET `/api/composite-views/:id`

Returns one composite view owned by current user.

### PATCH `/api/composite-views/:id`

Update name, description, layout or theme.

### DELETE `/api/composite-views/:id`

Soft delete.

## Publish Composite View

### POST `/api/composite-views/:id/publish`

Publish current composite view as a shareable dashboard.

Request body:

```json
{
  "title": "运营总览",
  "description": "公开分享版",
  "password": "Ab12"
}
```

Response shape:

```json
{
  "success": true,
  "data": {
    "publishedCompositeView": {
      "id": "c_published_id",
      "compositeId": "c_composite_id",
      "slug": "dashboard-xxxx",
      "title": "运营总览",
      "description": "公开分享版",
      "access": "PASSWORD",
      "isPublic": true,
      "shareUrl": "/chartly/composite-share?id=c_published_id"
    }
  },
  "meta": {}
}
```

## Public Read

### GET `/api/published-composite/:id/public`

Anonymous access.

Optional query:

- `password`

Examples:

```txt
/api/published-composite/c_published_id/public
/api/published-composite/c_published_id/public?password=Ab12
```

Response includes:

- published composite record
- `snapshotJson`
- widget chart snapshots

## Frontend Notes

- Editor page share URL:
  - `/chartly/composite-share?id=<publishedCompositeView.id>`
- Password-protected links may append:
  - `&password=Ab12`
- Public share page should use snapshot rendering, not live project editing state.
