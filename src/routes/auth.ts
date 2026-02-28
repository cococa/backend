import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import { fail, ok } from '../lib/api.js'
import {
  createSessionToken,
  getDemoCredentials,
  getOptionalUser,
  getSessionCookieName,
  getSessionMaxAge
} from '../lib/auth.js'
import { ensureDemoUser } from '../services/user.service.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export const authRoute = new Hono()

authRoute.get('/session', async c => {
  const user = await getOptionalUser(c)

  return c.json(
    ok({
      authenticated: Boolean(user),
      user
    })
  )
})

authRoute.post('/login', async c => {
  console.log('[auth/login] request:start')

  const body = await c.req.json().catch(() => null)
  console.log('[auth/login] request:body-parsed', {
    hasBody: Boolean(body),
    email: typeof body?.email === 'string' ? body.email : null
  })

  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    console.warn('[auth/login] request:invalid-body', {
      issues: parsed.error.issues.map(issue => ({
        path: issue.path.join('.'),
        code: issue.code
      }))
    })
    fail('INVALID_REQUEST', 'Email and password are required', 422)
  }

  const credentials = getDemoCredentials()
  console.log('[auth/login] credentials:loaded', {
    demoEmail: credentials.email
  })

  if (
    parsed.data.email !== credentials.email ||
    parsed.data.password !== credentials.password
  ) {
    console.warn('[auth/login] credentials:invalid', {
      email: parsed.data.email
    })
    fail('INVALID_CREDENTIALS', 'Invalid email or password', 401)
  }

  console.log('[auth/login] user:ensure-start', {
    email: credentials.email
  })
  const user = await ensureDemoUser({
    email: credentials.email,
    name: credentials.name
  })
  console.log('[auth/login] user:ensure-success', {
    id: user.id,
    email: user.email
  })

  const sessionUser = {
    id: user.id,
    email: user.email,
    name: user.name || credentials.name
  }

  console.log('[auth/login] token:create-start', {
    userId: sessionUser.id
  })
  const token = await createSessionToken(sessionUser)
  console.log('[auth/login] token:create-success', {
    userId: sessionUser.id
  })

  const isSecure = new URL(c.req.url).protocol === 'https:'

  setCookie(c, getSessionCookieName(), token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'None' : 'Lax',
    path: '/',
    maxAge: getSessionMaxAge()
  })
  console.log('[auth/login] cookie:set-success', {
    userId: sessionUser.id
  })

  console.log('[auth/login] response:success', {
    userId: sessionUser.id
  })
  return c.json(
    ok({
      user: sessionUser,
      token,
      expiresIn: getSessionMaxAge()
    })
  )
})

authRoute.post('/logout', c => {
  deleteCookie(c, getSessionCookieName(), {
    path: '/'
  })

  return c.json(
    ok({
      loggedOut: true
    })
  )
})
