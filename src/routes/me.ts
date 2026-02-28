import { Hono } from 'hono'
import { ok } from '../lib/api.js'
import { requireUser } from '../lib/auth.js'

export const meRoute = new Hono()

meRoute.get('/', async (c) => {
  const user = await requireUser(c)

  return c.json(
    ok({
      user,
      membership: {
        plan: 'FREE',
        status: 'ACTIVE'
      }
    })
  )
})
