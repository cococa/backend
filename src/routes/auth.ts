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
  const body = await c.req.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    fail('INVALID_REQUEST', 'Email and password are required', 422)
  }

  const credentials = getDemoCredentials()

  if (
    parsed.data.email !== credentials.email ||
    parsed.data.password !== credentials.password
  ) {
    fail('INVALID_CREDENTIALS', 'Invalid email or password', 401)
  }

  const user = await ensureDemoUser({
    email: credentials.email,
    name: credentials.name
  })

  const sessionUser = {
    id: user.id,
    email: user.email,
    name: user.name || credentials.name
  }

  const token = await createSessionToken(sessionUser)

  setCookie(c, getSessionCookieName(), token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: getSessionMaxAge()
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
