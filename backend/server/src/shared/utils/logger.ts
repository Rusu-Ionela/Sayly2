import { env } from "../../config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

const SERVICE = "backend";

const SECRET_KEYS = new Set([
  "password",
  "newpassword",
  "currentpassword",
  "confirmpassword",
  "passwordhash",
  "accesstoken",
  "refreshtoken",
  "token",
  "tokenhash",
  "authorization",
  "cookie",
  "code",
  "reseturl",
  "devcode",
  "challengeid",
  "database_url",
  "direct_url",
  "openai_api_key",
  "smtp_pass",
  "smtp_password",
  "redis_url",
  "redis_password",
  "redis_username",
]);

function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 8) {
    return "[depth-limit]";
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return "[circular]";
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1, seen));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      SECRET_KEYS.has(key.toLowerCase()) ? "[redacted]" : redact(nested, depth + 1, seen),
    ]),
  );
}

function write(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>) {
  if (level === "debug" && !env.enableDevLogs) {
    return;
  }

  const safe = meta ? (redact(meta) as Record<string, unknown>) : undefined;
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    service: SERVICE,
    scope,
    message,
  };

  if (safe && Object.keys(safe).length > 0) {
    Object.assign(entry, safe);
  }

  let line: string;
  try {
    line = JSON.stringify(entry);
  } catch {
    line = JSON.stringify({
      ts: entry.ts,
      level,
      service: SERVICE,
      scope,
      message,
      meta: "[unserializable]",
    });
  }

  switch (level) {
    case "debug":
      console.debug(line);
      break;
    case "info":
      console.info(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "error":
      console.error(line);
      break;
  }
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) {
    return "[invalid-email]";
  }

  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export const logger = {
  debug: (scope: string, message: string, meta?: Record<string, unknown>) =>
    write("debug", scope, message, meta),
  info: (scope: string, message: string, meta?: Record<string, unknown>) =>
    write("info", scope, message, meta),
  warn: (scope: string, message: string, meta?: Record<string, unknown>) =>
    write("warn", scope, message, meta),
  error: (scope: string, message: string, meta?: Record<string, unknown>) =>
    write("error", scope, message, meta),
};
