import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { APP_NAME, type Person } from 'shared'
import { env } from './env'

const app = new Hono()

app.get('/health', (c) => {
  // shared の型を消費して型共有の配線を確認する
  const sample: Person = { id: 'demo', name: '名無し' }
  return c.json({ status: 'ok', app: APP_NAME, sample })
})

const port = env.PORT
serve({ fetch: app.fetch, port })
console.log(`backend listening on http://localhost:${port}`)
