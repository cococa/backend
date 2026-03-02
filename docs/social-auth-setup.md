# Social Auth Setup

当前项目已经接入两种社交登录：

- Google
- GitHub

后端项目：
- `/Users/sj/Documents/cocoa/notion-chart/backend`

前端入口：
- `website`
- `notionChartWeb`

## Overview

后端统一提供这些 OAuth 入口：

- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/auth/github/start`
- `GET /api/auth/github/callback`

登录成功后，后端会：

1. 拉取第三方用户信息
2. 自动创建或更新本地用户
3. 写入 `chartly_session` cookie
4. 跳回 `returnTo`

## Vercel Env

`backend` 项目至少需要这些环境变量：

```env
AUTH_SECRET=replace-with-a-long-random-string
APP_URL=https://website-tau-rust-47.vercel.app
CORS_ALLOWED_ORIGINS=https://website-tau-rust-47.vercel.app,https://你的-chartly-域名
AUTH_ALLOWED_RETURN_TO_ORIGINS=https://website-tau-rust-47.vercel.app,https://你的-chartly-域名,http://localhost:3000,http://localhost:5173

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://backend-z6vv.vercel.app/api/auth/google/callback

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=https://backend-z6vv.vercel.app/api/auth/github/callback
```

说明：

- `AUTH_SECRET`
  - 用于签发 session token
- `APP_URL`
  - 兜底回跳地址
- `CORS_ALLOWED_ORIGINS`
  - 允许前端跨域请求 backend
- `AUTH_ALLOWED_RETURN_TO_ORIGINS`
  - 限制 OAuth 登录成功后的回跳域名

## Google Auth

### Google Cloud 需要配置

在 Google Cloud Console 里创建 OAuth Client 后，需要确认：

1. `Client ID`
2. `Client Secret`
3. `Authorized redirect URI`
4. `OAuth Consent Screen` 的测试用户

### Google 回调地址

生产环境建议填：

```txt
https://backend-z6vv.vercel.app/api/auth/google/callback
```

如果要本地调试，再额外加：

```txt
http://localhost:3100/api/auth/google/callback
```

### Google 需要回填到 backend 的变量

```env
GOOGLE_CLIENT_ID=你的 Google Client ID
GOOGLE_CLIENT_SECRET=你的 Google Client Secret
GOOGLE_REDIRECT_URI=https://backend-z6vv.vercel.app/api/auth/google/callback
```

### Google 注意事项

1. Google 测试模式下，只允许 OAuth Consent Screen 里配置过的测试用户登录
2. 如果回调时报错，先检查 redirect URI 是否完全一致
3. 如果登录页点击 Google 后直接报 `GOOGLE_AUTH_NOT_CONFIGURED`
   - 说明 Vercel 环境变量没配好或没重新部署

## GitHub Auth

### GitHub OAuth App 需要配置

在 GitHub Developer Settings -> OAuth Apps 里确认：

1. `Client ID`
2. `Client Secret`
3. `Authorization callback URL`

### GitHub 回调地址

生产环境应填：

```txt
https://backend-z6vv.vercel.app/api/auth/github/callback
```

### GitHub 需要回填到 backend 的变量

```env
GITHUB_CLIENT_ID=你的 GitHub Client ID
GITHUB_CLIENT_SECRET=你的 GitHub Client Secret
GITHUB_REDIRECT_URI=https://backend-z6vv.vercel.app/api/auth/github/callback
```

### GitHub 注意事项

1. 如果点击 GitHub 后 404
   - 先确认 backend 已部署到包含 GitHub 路由的最新版本
2. 如果返回 `GITHUB_AUTH_NOT_CONFIGURED`
   - 说明 backend 环境变量没配置完整
3. GitHub 用户邮箱可能不会直接出现在 `/user`
   - 当前后端已经补了 `/user/emails` 查询逻辑

## Frontend ReturnTo

前端当前会显式传 `returnTo`，后端会校验 origin 白名单。

当前建议的前端地址：

- `website`
  - `https://website-tau-rust-47.vercel.app`
- `notionChartWeb`
  - 你的正式 `chartly` 域名

所以 `AUTH_ALLOWED_RETURN_TO_ORIGINS` 里要包含这些 origin。

## Deploy Checklist

每次改完 OAuth 配置，按这个顺序检查：

1. 第三方平台的 callback URL 是否正确
2. `backend` 的 Vercel 环境变量是否已更新
3. `backend` 是否已重新部署
4. 前端环境变量中的 backend 地址是否正确
5. 登录后 `GET /api/auth/session` 是否返回：

```json
{
  "success": true,
  "data": {
    "authenticated": true
  }
}
```

## Quick Test

### Google

打开：

```txt
https://backend-z6vv.vercel.app/api/auth/google/start?returnTo=https%3A%2F%2Fwebsite-tau-rust-47.vercel.app%2Fauth%2Flogin
```

### GitHub

打开：

```txt
https://backend-z6vv.vercel.app/api/auth/github/start?returnTo=https%3A%2F%2Fwebsite-tau-rust-47.vercel.app%2Fauth%2Flogin
```

如果能正常跳到第三方授权页，说明 start 路由和环境变量基本正确。
