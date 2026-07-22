// ─── ConnectBuild CRM v3 — Structured Logger ─────────────────────────────────
// Observability-agent domain. Emits JSON-structured logs for Cloud Logging.
// Never throws — logging failures must NEVER break the main request flow.

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  timestamp: string;
  action: string;
  userId?: string | number | null;
  userRole?: string | null;
  entityType?: string | null;
  entityId?: string | number | null;
  durationMs?: number;
  statusCode?: number;
  message?: string;
  error?: string;
  stack?: string;
  [key: string]: unknown;
}

function emit(entry: LogEntry): void {
  try {
    // Cloud Logging picks up structured JSON from stdout
    const line = JSON.stringify({ ...entry, service: "crm-v3" });
    if (entry.level === "error" || entry.level === "warn") {
      console.error(line);
    } else {
      console.log(line);
    }
  } catch {
    // absolute last resort
    console.log("[logger] Failed to emit log entry");
  }
}

function makeEntry(level: LogLevel, action: string, meta?: Omit<LogEntry, "level" | "timestamp" | "action">): LogEntry {
  return {
    level,
    timestamp: new Date().toISOString(),
    action,
    ...meta,
  };
}

export const logger = {
  debug(action: string, meta?: Omit<LogEntry, "level" | "timestamp" | "action">) {
    if (process.env.NODE_ENV === "development") {
      emit(makeEntry("debug", action, meta));
    }
  },
  info(action: string, meta?: Omit<LogEntry, "level" | "timestamp" | "action">) {
    emit(makeEntry("info", action, meta));
  },
  warn(action: string, meta?: Omit<LogEntry, "level" | "timestamp" | "action">) {
    emit(makeEntry("warn", action, meta));
  },
  error(action: string, error?: unknown, meta?: Omit<LogEntry, "level" | "timestamp" | "action">) {
    const errMsg = error instanceof Error ? error.message : String(error ?? "unknown");
    const stack  = error instanceof Error ? error.stack : undefined;
    emit(makeEntry("error", action, { ...meta, error: errMsg, stack }));
  },
};

// ─── Request timer helper ──────────────────────────────────────────────────────
export function startTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}
