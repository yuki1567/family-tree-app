import { z } from 'zod'

/**
 * 起動時の環境変数バリデーション。
 * 値は Infisical が `process.env` に注入する。ここで検証し、
 * 型付きの `env` として公開する。
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  // DB 接続情報（Infisical 注入）。DB アクセス実装が入るまでは任意。
  DATABASE_URL: z.url().optional(),
})

export const env = envSchema.parse(process.env)
