export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_CREDENTIALS"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  | "TOKEN_REVOKED"
  | "RESET_TOKEN_INVALID"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR"
  | "NOT_IMPLEMENTED"
  | "BAD_REQUEST"
  | "CALLEE_OFFLINE"
  | "CALL_BUSY"
  | "CONNECTION_REQUIRED";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly fields?: Record<string, string>;
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    statusCode = 400,
    code: ErrorCode = "BAD_REQUEST",
    fields?: Record<string, string>,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
