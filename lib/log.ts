// Zero-dependency structured logger (RC1 P0-2). JSON lines — parseable by any log aggregator
// (Vercel/Datadog/etc.) with no SDK or new framework. Levels gated by LOG_LEVEL (default "info").
// Use in route handlers / server code; NOT in the pure kernel (which forbids Date/randomness).
type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = ORDER[(process.env.LOG_LEVEL as Level) || "info"] ?? 20;
const RELEASE = (process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 12);

export interface LogFields { requestId?: string; [k: string]: unknown }

function emit(level: Level, msg: string, fields?: LogFields): void {
  if (ORDER[level] < MIN) return;
  const line = JSON.stringify({ level, msg, ts: new Date().toISOString(), release: RELEASE, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, f?: LogFields) => emit("debug", msg, f),
  info: (msg: string, f?: LogFields) => emit("info", msg, f),
  warn: (msg: string, f?: LogFields) => emit("warn", msg, f),
  error: (msg: string, f?: LogFields) => emit("error", msg, f),
};

// Correlation id for a request: reuse an inbound x-request-id or mint one. Safe in route handlers
// (Web Crypto is available in the Node + Edge runtimes).
export function requestId(req?: Request): string {
  const inbound = req?.headers.get("x-request-id");
  if (inbound) return inbound.slice(0, 64);
  try { return crypto.randomUUID(); } catch { return `req_${Date.now().toString(36)}`; }
}
