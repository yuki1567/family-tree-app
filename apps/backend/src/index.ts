import { serve } from '@hono/node-server'
import app from './app'
import { env } from './env'

const port = env.PORT
serve({
	fetch: app.fetch,
	port,
})
console.log(`backend listening on http://localhost:${port}`)
