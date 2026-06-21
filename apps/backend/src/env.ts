import { z } from 'zod'

/**
 * 起動時の環境変数バリデーション。
 * ここで検証し、型付きの `env` として公開する。
 */
const envSchema = z.object({
	NODE_ENV: z
		.enum([
			'development',
			'production',
			'test',
		])
		.default('development'),
	PORT: z.coerce.number().int().positive().default(4000),
	DATABASE_URL: z.url(),
	CORS_ORIGIN: z.string().default('http://localhost:3000'),
})

export const env = envSchema.parse(process.env)
