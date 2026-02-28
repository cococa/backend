import { handle } from 'hono/vercel'
import { app } from './hono-app.js'

export { app }

export default handle(app)
