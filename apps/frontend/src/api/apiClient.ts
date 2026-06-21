import type { AppType } from '@backend/app'
import { hc } from 'hono/client'

const baseUrl =
	(import.meta.env.VITE_API_BASE_URL as string | undefined) ??
	'http://localhost:4000'

export const api = hc<AppType>(baseUrl)
