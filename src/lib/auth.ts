import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { sign, verify } from 'hono/jwt'
import { z } from 'zod'
import { fail } from './api'

const SESSION_COOKIE_NAME = 'chartly_session'
const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7

const sessionPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  exp: z.number().optional()
})

const fallbackAuthSecret = 'chartly-dev-secret'

export type SessionUser = {
  id: string
  email: string
  name: string
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME
}

export function getSessionMaxAge() {
  return SESSION_EXPIRES_IN_SECONDS
}

export function getAuthSecret() {
  return process.env.AUTH_SECRET || fallbackAuthSecret
}

export function getDemoCredentials() {
  return {
    email: process.env.AUTH_DEMO_EMAIL || 'demo@chartly.dev',
    password: process.env.AUTH_DEMO_PASSWORD || 'Chartly123!',
    name: process.env.AUTH_DEMO_NAME || 'Chartly Demo'
  }
}

export async function createSessionToken(user: SessionUser) {
  const now = Math.floor(Date.now() / 1000)

  return sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      iat: now,
      exp: now + SESSION_EXPIRES_IN_SECONDS
    },
    getAuthSecret(),
    'HS256'
  )
}

function getBearerToken(c: Context) {
  const authorization = c.req.header('authorization')

  if (!authorization) {
    return null
  }

  const [type, token] = authorization.split(' ')

  if (type?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
}

export async function getOptionalUser(c: Context): Promise<SessionUser | null> {
  const token = getBearerToken(c) || getCookie(c, SESSION_COOKIE_NAME)

  if (!token) {
    return null
  }

  try {
    const payload = await verify(token, getAuthSecret(), 'HS256')
    const parsed = sessionPayloadSchema.safeParse(payload)

    if (!parsed.success) {
      return null
    }

    return {
      id: parsed.data.sub,
      email: parsed.data.email,
      name: parsed.data.name
    }
  } catch {
    return null
  }
}

export async function requireUser(c: Context) {
  const user = await getOptionalUser(c)

  if (!user) {
    fail('UNAUTHORIZED', 'Authentication required', 401)
  }

  return user
}
