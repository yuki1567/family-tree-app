import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { env } from './env'
import { healthRoute } from './routes/health'

const app = new Hono()
	.use(
		cors({
			origin: env.CORS_ORIGIN,
		}),
	)
	.route('/', healthRoute)

export type AppType = typeof app
export default app
