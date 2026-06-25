import { pgTable, uuid, text, boolean, jsonb, timestamp, vector, pgEnum, integer, primaryKey } from 'drizzle-orm/pg-core';
import crypto from 'crypto';

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

// ── Auth.js Tables ───────────────────────────────────────────────────────────

export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  password: text("password"), // Custom field for credential auth
});

export const accounts = pgTable("account", {
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (account) => ({
  compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] })
}));

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verificationToken", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (vt) => ({
  compoundKey: primaryKey({ columns: [vt.identifier, vt.token] })
}));

// ── Chat History Tables ──────────────────────────────────────────────────────

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: text("conversationId").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user', 'model', 'function'
  content: text("content").notNull().default(''),
  toolCalls: jsonb("toolCalls"),
  toolResult: jsonb("toolResult"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

// ── Existing Tables ──────────────────────────────────────────────────────────

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

/**
 * Connected OAuth Accounts.
 */
export const oauthConnections = pgTable('oauth_connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  provider: text('provider').notNull(),
  accountEmail: text('account_email').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
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
export type OAuthConnection = typeof oauthConnections.$inferSelect;
export type NewOAuthConnection = typeof oauthConnections.$inferInsert;

