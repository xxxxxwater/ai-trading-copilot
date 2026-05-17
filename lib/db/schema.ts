import { pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
export const strategies = pgTable('strategies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  source: text('source').notNull(),
  language: text('language').notNull().default('unknown'),
  analysis: jsonb('analysis'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
