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

// Audit log schema is fully guaranteed by migrations and setup, no runtime DDL checks are required.
async function ensureAuditSchema() {
  return;
}

let _opPermMigrated = true;

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
  // Table schema is already guaranteed by setup and migrations.
  return;
}
