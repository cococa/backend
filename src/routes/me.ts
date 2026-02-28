import { Hono } from 'hono'
import { ok } from '../lib/api'
import { requireUser } from '../lib/auth'

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
