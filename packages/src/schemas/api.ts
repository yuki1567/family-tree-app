import { z } from 'zod'

export const errorCodeSchema = z.enum([
	'VALIDATION_ERROR',
	'NOT_FOUND',
	'UNAUTHORIZED',
	'FORBIDDEN',
	'INTERNAL_ERROR',
])
export type ErrorCode = z.infer<typeof errorCodeSchema>

export const errorDetailSchema = z.object({
	field: z.string(),
	code: z.string(),
})
export type ErrorDetail = z.infer<typeof errorDetailSchema>

export const apiErrorResponseSchema = z.object({
	error: z.object({
		code: errorCodeSchema,
		details: z.array(errorDetailSchema).optional(),
	}),
})
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>
