import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { z } from 'zod'
import { fail, ok } from '../lib/api.js'
import { sendEmail, canSendEmail } from '../lib/email.js'

import {
  createOAuthStateToken,
  createSessionToken,
  getAllowedReturnToOrigins,
  getDemoCredentials,
  getGithubCredentials,
  getGoogleCredentials,
  getOptionalUser,
  getSessionCookieName,
  getSessionMaxAge,
  parseOAuthStateToken
} from '../lib/auth.js'
import {
  ensureDemoUser,
  ensureOAuthUser,
  findLocalUserByEmail,
  issueEmailVerificationToken,
  consumeEmailVerificationToken,
  registerLocalUser
} from '../services/user.service.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

const registerSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    email: z.string().trim().email(),
    password: z.string().min(8).max(128),
    passwordConfirm: z.string().min(8).max(128)
  })
  .refine(data => data.password === data.passwordConfirm, {
    message: 'Password confirmation does not match',
    path: ['passwordConfirm']
  })

const resendVerificationSchema = z.object({
  email: z.string().trim().email()
})

const googleTokenInfoSchema = z.object({
  aud: z.string().min(1),
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.union([z.literal('true'), z.literal('false')]).optional(),
  name: z.string().optional(),
  picture: z.string().optional()
})

const githubTokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  scope: z.string().optional()
})

const githubUserSchema = z.object({
  id: z.number(),
  login: z.string().min(1),
  name: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  avatar_url: z.string().url().nullable().optional()
})

const githubEmailSchema = z.object({
  email: z.string().email(),
  primary: z.boolean().optional(),
  verified: z.boolean().optional()
})

export const authRoute = new Hono()
const scrypt = promisify(scryptCallback)

authRoute.get('/google/start', async c => {
  const google = getGoogleCredentials()

  if (!google.clientId || !google.clientSecret) {
    fail('GOOGLE_AUTH_NOT_CONFIGURED', 'Google auth is not configured', 500)
  }

  const requestedReturnTo = c.req.query('returnTo') || process.env.APP_URL || '/'
  const safeReturnTo = normalizeAllowedReturnTo(requestedReturnTo)
  const state = await createOAuthStateToken({
    returnTo: safeReturnTo
  })
  const redirectUri =
    google.redirectUri || `${new URL(c.req.url).origin}/api/auth/google/callback`

  const params = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'select_account'
  })

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
})

authRoute.get('/github/start', async c => {
  const github = getGithubCredentials()

  if (!github.clientId || !github.clientSecret) {
    fail('GITHUB_AUTH_NOT_CONFIGURED', 'GitHub auth is not configured', 500)
  }

  const requestedReturnTo = c.req.query('returnTo') || process.env.APP_URL || '/'
  const safeReturnTo = normalizeAllowedReturnTo(requestedReturnTo)
  const state = await createOAuthStateToken({
    returnTo: safeReturnTo
  })
  const redirectUri =
    github.redirectUri || `${new URL(c.req.url).origin}/api/auth/github/callback`

  const params = new URLSearchParams({
    client_id: github.clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state
  })

  return c.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`)
})

authRoute.get('/google/callback', async c => {
  const google = getGoogleCredentials()
  const error = c.req.query('error')
  const code = c.req.query('code')
  const stateToken = c.req.query('state')
  const fallbackReturnTo = process.env.APP_URL || '/'

  const state = stateToken ? await parseOAuthStateToken(stateToken) : null
  const returnTo = state?.returnTo || fallbackReturnTo

  if (!google.clientId || !google.clientSecret) {
    return c.redirect(appendAuthError(returnTo, 'google_not_configured'))
  }

  if (error || !code) {
    return c.redirect(appendAuthError(returnTo, error || 'google_auth_failed'))
  }

  const redirectUri =
    google.redirectUri || `${new URL(c.req.url).origin}/api/auth/google/callback`

  const tokenResponse = (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: google.clientId,
      client_secret: google.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    }).toString()
  }).catch(() => null)) as
    | {
        ok: boolean
        json: () => Promise<unknown>
      }
    | null

  if (!tokenResponse?.ok) {
    return c.redirect(appendAuthError(returnTo, 'google_token_exchange_failed'))
  }

  const tokenJson = (await tokenResponse.json().catch(() => null)) as
    | { id_token?: string }
    | null

  if (!tokenJson?.id_token) {
    return c.redirect(appendAuthError(returnTo, 'google_id_token_missing'))
  }

  const tokenInfoResponse = (await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenJson.id_token)}`
  ).catch(() => null)) as
    | {
        ok: boolean
        json: () => Promise<unknown>
      }
    | null

  if (!tokenInfoResponse?.ok) {
    return c.redirect(appendAuthError(returnTo, 'google_token_verify_failed'))
  }

  const tokenInfoJson = await tokenInfoResponse.json().catch(() => null)
  const tokenInfo = googleTokenInfoSchema.safeParse(tokenInfoJson)

  if (!tokenInfo.success || tokenInfo.data.aud !== google.clientId) {
    return c.redirect(appendAuthError(returnTo, 'google_token_invalid'))
  }

  const user = await ensureOAuthUser({
    provider: 'google',
    providerUserId: tokenInfo.data.sub,
    email: tokenInfo.data.email,
    name: tokenInfo.data.name || tokenInfo.data.email,
    avatar: tokenInfo.data.picture || null
  }).catch(() => null)

  if (!user) {
    return c.redirect(appendAuthError(returnTo, 'google_user_upsert_failed'))
  }

  const sessionUser = {
    id: user.id,
    email: user.email,
    name: user.name || tokenInfo.data.email,
    avatar: user.avatar || tokenInfo.data.picture || null
  }

  const token = await createSessionToken(sessionUser)
  const isSecure = new URL(c.req.url).protocol === 'https:'

  setCookie(c, getSessionCookieName(), token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'None' : 'Lax',
    path: '/',
    maxAge: getSessionMaxAge()
  })

  return c.redirect(appendAuthSuccess(returnTo, 'google'))
})

authRoute.get('/github/callback', async c => {
  const github = getGithubCredentials()
  const error = c.req.query('error')
  const code = c.req.query('code')
  const stateToken = c.req.query('state')
  const fallbackReturnTo = process.env.APP_URL || '/'

  const state = stateToken ? await parseOAuthStateToken(stateToken) : null
  const returnTo = state?.returnTo || fallbackReturnTo

  if (!github.clientId || !github.clientSecret) {
    return c.redirect(appendAuthError(returnTo, 'github_not_configured'))
  }

  if (error || !code) {
    return c.redirect(appendAuthError(returnTo, error || 'github_auth_failed'))
  }

  const redirectUri =
    github.redirectUri || `${new URL(c.req.url).origin}/api/auth/github/callback`

  const tokenResponse = (await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: github.clientId,
      client_secret: github.clientSecret,
      code,
      redirect_uri: redirectUri
    }).toString()
  }).catch(() => null)) as
    | {
        ok: boolean
        json: () => Promise<unknown>
      }
    | null

  if (!tokenResponse?.ok) {
    return c.redirect(appendAuthError(returnTo, 'github_token_exchange_failed'))
  }

  const tokenJson = githubTokenSchema.safeParse(await tokenResponse.json().catch(() => null))

  if (!tokenJson.success) {
    return c.redirect(appendAuthError(returnTo, 'github_token_invalid'))
  }

  const githubAccessToken = tokenJson.data.access_token

  const userResponse = (await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${githubAccessToken}`,
      'User-Agent': 'chartly-auth'
    }
  }).catch(() => null)) as
    | {
        ok: boolean
        json: () => Promise<unknown>
      }
    | null

  if (!userResponse?.ok) {
    return c.redirect(appendAuthError(returnTo, 'github_user_fetch_failed'))
  }

  const githubUserResult = githubUserSchema.safeParse(await userResponse.json().catch(() => null))

  if (!githubUserResult.success) {
    return c.redirect(appendAuthError(returnTo, 'github_user_invalid'))
  }

  let email = githubUserResult.data.email || ''

  if (!email) {
    const emailResponse = (await fetch('https://api.github.com/user/emails', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${githubAccessToken}`,
        'User-Agent': 'chartly-auth'
      }
    }).catch(() => null)) as
      | {
          ok: boolean
          json: () => Promise<unknown>
        }
      | null

    if (!emailResponse?.ok) {
      return c.redirect(appendAuthError(returnTo, 'github_email_fetch_failed'))
    }

    const emailResult = z.array(githubEmailSchema).safeParse(await emailResponse.json().catch(() => null))

    if (!emailResult.success) {
      return c.redirect(appendAuthError(returnTo, 'github_email_invalid'))
    }

    const primaryEmail =
      emailResult.data.find(item => item.primary && item.verified)?.email ||
      emailResult.data.find(item => item.verified)?.email ||
      emailResult.data[0]?.email ||
      ''

    email = primaryEmail
  }

  if (!email) {
    return c.redirect(appendAuthError(returnTo, 'github_email_missing'))
  }

  const user = await ensureOAuthUser({
    provider: 'github',
    providerUserId: String(githubUserResult.data.id),
    email,
    name: githubUserResult.data.name || githubUserResult.data.login,
    avatar: githubUserResult.data.avatar_url || null
  }).catch(() => null)

  if (!user) {
    return c.redirect(appendAuthError(returnTo, 'github_user_upsert_failed'))
  }

  const sessionUser = {
    id: user.id,
    email: user.email,
    name: user.name || githubUserResult.data.login,
    avatar: user.avatar || githubUserResult.data.avatar_url || null
  }

  const token = await createSessionToken(sessionUser)
  const isSecure = new URL(c.req.url).protocol === 'https:'

  setCookie(c, getSessionCookieName(), token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'None' : 'Lax',
    path: '/',
    maxAge: getSessionMaxAge()
  })

  return c.redirect(appendAuthSuccess(returnTo, 'github'))
})

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

  const localUser = await findLocalUserByEmail(parsed.data.email)

  if (localUser?.passwordCredential) {
    if (!localUser.emailVerifiedAt) {
      fail('EMAIL_NOT_VERIFIED', 'Please verify your email before logging in', 403)
    }

    const validPassword = await verifyPassword(
      parsed.data.password,
      localUser.passwordCredential.passwordHash
    )

    if (!validPassword) {
      console.warn('[auth/login] credentials:invalid', {
        email: parsed.data.email,
        mode: 'local'
      })
      fail('INVALID_CREDENTIALS', 'Invalid email or password', 401)
    }

    const sessionUser = {
      id: localUser.id,
      email: localUser.email,
      name: localUser.name || localUser.email,
      avatar: localUser.avatar || null
    }

    const token = await createSessionToken(sessionUser)
    const isSecure = new URL(c.req.url).protocol === 'https:'

    setCookie(c, getSessionCookieName(), token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'None' : 'Lax',
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
  }

  if (
    parsed.data.email !== credentials.email ||
    parsed.data.password !== credentials.password
  ) {
    console.warn('[auth/login] credentials:invalid', {
      email: parsed.data.email,
      mode: 'demo'
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
    name: user.name || credentials.name,
    avatar: user.avatar || null
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

authRoute.post('/register', async c => {
  const body = await c.req.json().catch(() => null)
  const parsed = registerSchema.safeParse(body)

  if (!parsed.success) {
    fail(
      'INVALID_REQUEST',
      parsed.error.issues[0]?.message || 'Invalid registration payload',
      422
    )
  }

  const passwordHash = await hashPassword(parsed.data.password)
  const result = await registerLocalUser({
    email: parsed.data.email,
    name: parsed.data.name,
    passwordHash
  })

  if (!result.created) {
    fail('EMAIL_ALREADY_REGISTERED', 'Email has already been registered', 409)
  }

  const token = await issueEmailVerificationToken(result.user.id)
  const verificationUrl = buildEmailVerificationUrl(c.req.url, token.rawToken)
  const mailResult = await sendVerificationEmail({
    email: result.user.email,
    name: result.user.name || parsed.data.name,
    verificationUrl
  })

  if (!mailResult.sent && process.env.VERCEL_ENV === 'production') {
    fail('EMAIL_SEND_FAILED', 'Failed to send verification email', 500)
  }

  return c.json(
    ok({
      verificationRequired: true,
      email: result.user.email,
      verificationEmailSent: mailResult.sent,
      verificationUrlPreview: mailResult.sent ? null : verificationUrl
    })
  )
})

authRoute.post('/resend-verification', async c => {
  const body = await c.req.json().catch(() => null)
  const parsed = resendVerificationSchema.safeParse(body)

  if (!parsed.success) {
    fail('INVALID_REQUEST', 'Valid email is required', 422)
  }

  const user = await findLocalUserByEmail(parsed.data.email)

  if (!user?.passwordCredential) {
    fail('USER_NOT_FOUND', 'Account not found', 404)
  }

  if (user.emailVerifiedAt) {
    return c.json(
      ok({
        verificationRequired: false,
        email: user.email
      })
    )
  }

  const token = await issueEmailVerificationToken(user.id)
  const verificationUrl = buildEmailVerificationUrl(c.req.url, token.rawToken)
  const mailResult = await sendVerificationEmail({
    email: user.email,
    name: user.name || user.email,
    verificationUrl
  })

  if (!mailResult.sent && process.env.VERCEL_ENV === 'production') {
    fail('EMAIL_SEND_FAILED', 'Failed to send verification email', 500)
  }

  return c.json(
    ok({
      verificationRequired: true,
      email: user.email,
      verificationEmailSent: mailResult.sent,
      verificationUrlPreview: mailResult.sent ? null : verificationUrl
    })
  )
})

authRoute.get('/verify-email', async c => {
  const token = c.req.query('token') || ''
  const fallbackReturnTo = process.env.EMAIL_VERIFY_RETURN_URL || process.env.APP_URL || '/'

  if (!token) {
    return c.redirect(appendAuthError(fallbackReturnTo, 'verification_token_missing'))
  }

  const user = await consumeEmailVerificationToken(token).catch(() => null)

  if (!user) {
    return c.redirect(appendAuthError(fallbackReturnTo, 'verification_token_invalid'))
  }

  const sessionUser = {
    id: user.id,
    email: user.email,
    name: user.name || user.email,
    avatar: user.avatar || null
  }

  const sessionToken = await createSessionToken(sessionUser)
  const isSecure = new URL(c.req.url).protocol === 'https:'

  setCookie(c, getSessionCookieName(), sessionToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'None' : 'Lax',
    path: '/',
    maxAge: getSessionMaxAge()
  })

  return c.redirect(appendAuthSuccess(fallbackReturnTo, 'email'))
})

authRoute.post('/logout', c => {
  const isSecure = new URL(c.req.url).protocol === 'https:'

  deleteCookie(c, getSessionCookieName(), {
    path: '/',
    secure: isSecure,
    sameSite: isSecure ? 'None' : 'Lax',
    httpOnly: true
  })

  return c.json(
    ok({
      loggedOut: true
    })
  )
})

function appendAuthError(returnTo: string, reason: string) {
  const url = resolveReturnToUrl(returnTo)
  url.searchParams.set('authError', reason)
  return url.toString()
}

function appendAuthSuccess(returnTo: string, provider: string) {
  const url = resolveReturnToUrl(returnTo)
  url.searchParams.set('authProvider', provider)
  return url.toString()
}

function resolveReturnToUrl(returnTo: string) {
  const base = process.env.APP_URL || 'http://localhost:3000'
  return new URL(returnTo, base)
}

function normalizeAllowedReturnTo(returnTo: string) {
  const resolved = resolveReturnToUrl(returnTo)
  const allowedOrigins = getAllowedReturnToOrigins()

  if (!allowedOrigins.length) {
    return resolved.toString()
  }

  const isAllowed = allowedOrigins.some(origin => {
    try {
      return new URL(origin).origin === resolved.origin
    } catch {
      return false
    }
  })

  return isAllowed ? resolved.toString() : process.env.APP_URL || resolved.origin
}

function buildEmailVerificationUrl(requestUrl: string, token: string) {
  const backendOrigin = new URL(requestUrl).origin
  return `${backendOrigin}/api/auth/verify-email?token=${encodeURIComponent(token)}`
}

async function sendVerificationEmail(input: {
  email: string
  name: string
  verificationUrl: string
}) {
  if (!canSendEmail()) {
    return {
      sent: false as const
    }
  }

  const subject = 'Verify your Chartly email'
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>Complete your Chartly registration by verifying your email.</p>
      <p>
        <a href="${input.verificationUrl}" style="display:inline-block;padding:10px 16px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;">
          Verify Email
        </a>
      </p>
      <p>If the button does not work, open this link:</p>
      <p>${escapeHtml(input.verificationUrl)}</p>
    </div>
  `.trim()

  const text = `Hi ${input.name},\n\nVerify your Chartly email:\n${input.verificationUrl}`

  return sendEmail({
    to: input.email,
    subject,
    html,
    text
  })
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

async function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(':')

  if (!salt || !hash) {
    return false
  }

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer
  const storedKey = Buffer.from(hash, 'hex')

  if (derivedKey.length !== storedKey.length) {
    return false
  }

  return timingSafeEqual(derivedKey, storedKey)
}
