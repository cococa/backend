import { Hono } from 'hono'
import { ok } from '../lib/api'

export const billingRoute = new Hono()

billingRoute.get('/membership', (c) => {
  return c.json(
    ok({
      membership: {
        plan: 'FREE',
        status: 'ACTIVE'
      }
    })
  )
})
