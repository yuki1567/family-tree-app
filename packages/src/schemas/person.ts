import { z } from 'zod'

export const genderSchema = z.enum([
	'male',
	'female',
	'other',
	'unknown',
])
export type Gender = z.infer<typeof genderSchema>

export const personSchema = z.object({
	id: z.string(),
	name: z.string(),
	gender: genderSchema.optional(),
	birthDate: z.string().optional(),
	deathDate: z.string().optional(),
	birthPlace: z.string().optional(),
	note: z.string().optional(),
})
export type Person = z.infer<typeof personSchema>
