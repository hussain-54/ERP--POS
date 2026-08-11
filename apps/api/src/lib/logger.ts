/**
 * Structured application logger for production.
 * Never log passwords, tokens, payment secrets, or service-role keys.
 */
export type LogCategory =
  | "auth"
  | "api"
  | "database"
  | "sqlite"
  | "sync"
  | "printing"
  | "hardware"
  | "application";

export type LogLevel = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEY =
  /(password|passwd|secret|token|authorization|api[_-]?key|service[_-]?role|private[_-]?key|refresh[_-]?token|access[_-]?token|credit[_-]?card|cvv|pin)/i;

export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[Truncated]";
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.length > 500) return `${value.slice(0, 120)}…[redacted-length:${value.length}]`;
    return value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redactSensitive(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) ? "[REDACTED]" : redactSensitive(v, depth + 1);
  }
  return out;
}

export interface LogFields {
  category: LogCategory;
  message: string;
  requestId?: string;
  userId?: string;
  organizationId?: string;
  err?: unknown;
  meta?: Record<string, unknown>;
}

function serializeError(err: unknown): Record<string, unknown> | undefined {
  if (err == null) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    };
  }
  return { message: String(err) };
}

function emit(level: LogLevel, fields: LogFields): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    category: fields.category,
    message: fields.message,
    requestId: fields.requestId,
    userId: fields.userId,
    organizationId: fields.organizationId,
    err: serializeError(fields.err),
    meta: fields.meta ? (redactSensitive(fields.meta) as Record<string, unknown>) : undefined,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (fields: LogFields) => {
    if ((process.env.LOG_LEVEL ?? "info") === "debug") emit("debug", fields);
  },
  info: (fields: LogFields) => emit("info", fields),
  warn: (fields: LogFields) => emit("warn", fields),
  error: (fields: LogFields) => emit("error", fields),
};
