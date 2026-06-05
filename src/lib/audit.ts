import { db } from "@/db";
import { sql } from "drizzle-orm";

export interface AuditParams {
  userId?: number | null;
  userName?: string;
  userRole?: string;
  action: string;
  entityType?: string;
  entityId?: number | null;
  status?: "success" | "failed" | "blocked" | "pending";
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

// Run once per process start — guards are cheap after the first call
let _auditMigrated = false;
async function ensureAuditSchema() {
  if (_auditMigrated) return;
  try {
    await db.execute(sql`
      ALTER TABLE audit_log
        ADD COLUMN IF NOT EXISTS user_name  TEXT,
        ADD COLUMN IF NOT EXISTS user_role  TEXT,
        ADD COLUMN IF NOT EXISTS status     TEXT DEFAULT 'success',
        ADD COLUMN IF NOT EXISTS ip_address TEXT
    `);
    _auditMigrated = true;
  } catch {
    // Non-fatal — column may already exist
    _auditMigrated = true;
  }
}

let _opPermMigrated = false;

/**
 * Enterprise-grade audit logger.
 * NEVER throws — audit failure must never break the main flow.
 */
export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    await ensureAuditSchema();

    await db.execute(sql`
      INSERT INTO audit_log
        (user_id, user_name, user_role, action, entity_type, entity_id, status, ip_address, metadata, created_at)
      VALUES
        (${params.userId ?? null},
         ${params.userName ?? null},
         ${params.userRole ?? null},
         ${params.action},
         ${params.entityType ?? null},
         ${params.entityId ?? null},
         ${params.status ?? "success"},
         ${params.ipAddress ?? null},
         ${params.metadata ? JSON.stringify(params.metadata) : null}::jsonb,
         NOW())
    `);
  } catch {
    // Non-fatal: silently swallow
  }
}

/**
 * Auto-creates the operation_permissions table if it doesn't exist.
 * Uses a process-level flag so the DDL only runs once per server restart.
 */
export async function ensureOpPermTable(): Promise<void> {
  if (_opPermMigrated) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS operation_permissions (
        id                SERIAL PRIMARY KEY,
        requested_by      INTEGER,
        requested_by_name TEXT,
        operation         TEXT NOT NULL,
        description       TEXT,
        status            TEXT DEFAULT 'pending',
        approved_by       INTEGER,
        approved_by_name  TEXT,
        confirmed_at      TIMESTAMP,
        expires_at        TIMESTAMP,
        metadata          JSONB,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    _opPermMigrated = true;
  } catch {
    _opPermMigrated = true;
  }
}
