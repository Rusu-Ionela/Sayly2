type LogLevel = "debug" | "info" | "warn" | "error";

const SERVICE = "frontend";

const enabled =
  typeof __DEV__ !== "undefined"
    ? __DEV__ || process.env.EXPO_PUBLIC_DEBUG_LOGS === "true"
    : process.env.EXPO_PUBLIC_DEBUG_LOGS === "true";

/** Keys must be lowercase — lookups use key.toLowerCase(). */
const SENSITIVE_KEYS = new Set([
  "password",
  "confirmpassword",
  "refreshtoken",
  "accesstoken",
  "token",
  "authorization",
  "resettoken",
  "resetcode",
  "challengeid",
  "devcode",
]);

function redactValue(key: string, value: unknown): unknown {
  const normalizedKey = key.toLowerCase();

  if (SENSITIVE_KEYS.has(normalizedKey)) {
    return "[redacted]";
  }

  if (normalizedKey === "email" && typeof value === "string") {
    return maskEmail(value);
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        redactValue(childKey, childValue),
      ]),
    );
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => redactValue(String(index), item));
  }

  return value;
}

function redactMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => [key, redactValue(key, value)]),
  );
}

function write(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>) {
  if (!enabled) {
    return;
  }

  const safe = redactMeta(meta);
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

export const log = {
  debug: (scope: string, message: string, meta?: Record<string, unknown>) =>
    write("debug", scope, message, meta),
  info: (scope: string, message: string, meta?: Record<string, unknown>) =>
    write("info", scope, message, meta),
  warn: (scope: string, message: string, meta?: Record<string, unknown>) =>
    write("warn", scope, message, meta),
  error: (scope: string, message: string, meta?: Record<string, unknown>) =>
    write("error", scope, message, meta),
};

/** Mask local part and domain so logs are not identifying. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) {
    return "[invalid-email]";
  }

  const visibleLocal = local.slice(0, Math.min(1, local.length));
  const domainParts = domain.split(".");
  const tld = domainParts.length > 1 ? domainParts[domainParts.length - 1] : "tld";
  return `${visibleLocal}***@***.${tld}`;
}
