import { AppError } from "../shared/errors/AppError";

/** Walk wrapped errors (Drizzle/pg) for a PostgreSQL SQLSTATE. */
export function pgErrorCode(error: unknown): string | undefined {
  const seen = new Set<unknown>();
  let current: unknown = error;

  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth += 1) {
    if (seen.has(current)) {
      break;
    }
    seen.add(current);
    if ("code" in current && typeof current.code === "string") {
      return current.code;
    }
    current = "cause" in current ? current.cause : undefined;
  }

  return undefined;
}

export function pgConstraint(error: unknown): string | undefined {
  const seen = new Set<unknown>();
  let current: unknown = error;

  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth += 1) {
    if (seen.has(current)) {
      break;
    }
    seen.add(current);
    if ("constraint" in current && typeof current.constraint === "string") {
      return current.constraint;
    }
    current = "cause" in current ? current.cause : undefined;
  }

  return undefined;
}

/** Postgres unique_violation (23505). */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (pgErrorCode(error) !== "23505") {
    return false;
  }
  if (!constraint) {
    return true;
  }
  return pgConstraint(error) === constraint;
}

/**
 * Known database failures as a safe client-facing error (never the SQL or its values).
 * Deadlock / serialization / statement timeout are transient: 503 + Retry-After, the client retries.
 */
export function dbFailureToAppError(error: unknown): AppError | undefined {
  switch (pgErrorCode(error)) {
    case "23503": // foreign_key_violation
      return new AppError("This action conflicts with related data", 409, "CONFLICT");
    case "40P01": // deadlock_detected
    case "40001": // serialization_failure
    case "57014": // query_canceled (statement_timeout)
      return new AppError("Temporarily busy, please try again", 503, "SERVICE_UNAVAILABLE", undefined, 1);
    default:
      return undefined;
  }
}
