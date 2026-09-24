import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const strategies = pgTable('strategies', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  source: text('source').notNull(),
  language: text('language').notNull().default('unknown'),
  currentVersion: integer('current_version').notNull().default(1),
  analysis: jsonb('analysis'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const strategyVersions = pgTable('strategy_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  strategyId: uuid('strategy_id').notNull().references(() => strategies.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  source: text('source').notNull(),
  sourceHash: text('source_hash').notNull(),
  ir: jsonb('ir'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const analysisRuns = pgTable('analysis_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  strategyId: uuid('strategy_id').references(() => strategies.id, { onDelete: 'set null' }),
  sourceHash: text('source_hash').notNull(),
  model: text('model'),
  promptVersion: text('prompt_version').notNull().default('strategy-review-v2'),
  status: text('status').notNull().default('completed'),
  deterministicOutput: jsonb('deterministic_output').notNull(),
  aiOutput: jsonb('ai_output'),
  toolTrace: jsonb('tool_trace'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const backtestRuns = pgTable('backtest_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  strategyId: uuid('strategy_id').references(() => strategies.id, { onDelete: 'set null' }),
  sourceHash: text('source_hash').notNull(),
  symbol: text('symbol').notNull(),
  timeframe: text('timeframe').notNull(),
  dataSource: text('data_source').notNull(),
  datasetHash: text('dataset_hash'),
  engineVersion: text('engine_version').notNull(),
  assumptions: jsonb('assumptions').notNull(),
  metrics: jsonb('metrics').notNull(),
  trades: jsonb('trades').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
