import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodTypeAny } from 'zod'

export const validate = <T extends ZodTypeAny>(
	target: keyof ValidationTargets,
	schema: T,
) =>
	zValidator(target, schema, (result, c) => {
		if (!result.success) {
			return c.json(
				{
					error: {
						code: 'VALIDATION_ERROR' as const,
						details: result.error.issues.map((i) => ({
							field: i.path.join('.'),
							code: i.code,
						})),
					},
				},
				400,
			)
		}
	})
