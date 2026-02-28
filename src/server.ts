import { serve } from '@hono/node-server'
import app from './app.js'

const port = Number(process.env.PORT || 3300)

serve(
  {
    fetch: app.fetch,
    port
  },
  info => {
    console.log(`chartly-backend running at http://localhost:${info.port}`)
  }
)
