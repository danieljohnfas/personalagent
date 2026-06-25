import { desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditLog, AuditLogEntry, NewAuditLogEntry } from '../db/schema.js';

export async function logAction(entry: Omit<NewAuditLogEntry, 'id' | 'timestamp'>): Promise<string> {
  const [result] = await db.insert(auditLog)
    .values(entry)
    .returning({ id: auditLog.id });

  if (!result) {
    throw new Error('Failed to insert audit log entry');
  }

  return result.id;
}

export async function getRecentActions(limit: number = 50): Promise<AuditLogEntry[]> {
  const results = await db.select()
    .from(auditLog)
    .orderBy(desc(auditLog.timestamp))
    .limit(limit);

  return results;
}
