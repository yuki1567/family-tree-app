import {
	date,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core'
import type { Gender } from 'shared'

export const persons = pgTable('persons', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: varchar('name', {
		length: 100,
	}),
	gender: varchar('gender', {
		length: 10,
	}).$type<Gender>(),
	birthDate: date('birth_date'),
	deathDate: date('death_date'),
	birthPlace: varchar('birth_place', {
		length: 200,
	}),
	note: text('note'),
	createdAt: timestamp('created_at', {
		precision: 3,
		mode: 'date',
	})
		.notNull()
		.defaultNow(),
	updatedAt: timestamp('updated_at', {
		precision: 3,
		mode: 'date',
	})
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
})

export type PersonRecord = typeof persons.$inferSelect
export type NewPersonRecord = typeof persons.$inferInsert
