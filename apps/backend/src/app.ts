import { Hono } from 'hono'
import { healthRoute } from './routes/health'

const app = new Hono().route('/', healthRoute)

export type AppType = typeof app
export default app
