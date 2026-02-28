import type { Context } from 'hono'

export async function requireUser(c: Context) {
  const user = c.get('user') || {
    id: 'demo-user',
    email: 'demo@example.com',
    name: 'Demo User'
  }

  return user
}
