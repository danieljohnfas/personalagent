import { pgTable, uuid, text, boolean, jsonb, timestamp, vector, pgEnum } from 'drizzle-orm/pg-core';

// ── Enums ────────────────────────────────────────────────────────────────────

export const auditStatusEnum = pgEnum('audit_status', [
  'pending',
  'approved',
  'denied',
  'executed',
  'failed',
]);

export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',
  'approved',
  'denied',
]);

// ── Tables ───────────────────────────────────────────────────────────────────

/**
 * Append-only log of every action the agent takes.
 * Never truncate or delete rows from this table.
 */
export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  agentId: text('agent_id').notNull(),
  action: text('action').notNull(),
  target: text('target').notNull(),
  status: auditStatusEnum('status').notNull().default('pending'),
  reversible: boolean('reversible').notNull().default(false),
  metadata: jsonb('metadata'),
});

/**
 * Long-term semantic memory — stored as 1536-dim OpenAI embeddings.
 */
export const agentMemory = pgTable('agent_memory', {
  id: uuid('id').defaultRandom().primaryKey(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  tags: text('tags').array().notNull().default([]),
});

/**
 * Approval requests — any irreversible action pauses here until resolved.
 */
export const approvals = pgTable('approvals', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  actionDescription: text('action_description').notNull(),
  payload: jsonb('payload').notNull(),
  status: approvalStatusEnum('status').notNull().default('pending'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

/**
 * Registry of MCP server connections.
 * mock_mode: true (default) → routes to MockMCPServer, never touches real accounts.
 * enabled: false (default) → connection is inactive even if mock_mode is false.
 */
export const mcpConnections = pgTable('mcp_connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  enabled: boolean('enabled').notNull().default(false),
  mockMode: boolean('mock_mode').notNull().default(true),
  config: jsonb('config').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
export type AgentMemory = typeof agentMemory.$inferSelect;
export type NewAgentMemory = typeof agentMemory.$inferInsert;
export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;
export type MCPConnection = typeof mcpConnections.$inferSelect;
export type NewMCPConnection = typeof mcpConnections.$inferInsert;
