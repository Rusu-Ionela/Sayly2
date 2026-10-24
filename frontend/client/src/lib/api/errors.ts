type ApiErrorBody = {
  success?: false;
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(options: {
    status: number;
    code: string;
    message: string;
    fields?: Record<string, string>;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.fields = options.fields;
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    let body: ApiErrorBody | null = null;

    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = null;
    }

    const code = body?.error?.code ?? defaultCodeForStatus(response.status);
    const message = body?.error?.message ?? defaultMessageForStatus(response.status);
    const fields = body?.error?.fields;

    return new ApiError({
      status: response.status,
      code,
      message,
      fields,
    });
  }

  get isValidation(): boolean {
    return this.code === "VALIDATION_ERROR" || this.status === 400;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isConflict(): boolean {
    return this.code === "CONFLICT" || this.status === 409;
  }

  get isRateLimited(): boolean {
    return this.code === "RATE_LIMITED" || this.status === 429;
  }

  get isNetwork(): boolean {
    return this.code === "NETWORK_ERROR";
  }
}

export function isApiError(error: unknown): error is ApiError {
  if (error instanceof ApiError) {
    return true;
  }
  if (!error || typeof error !== "object") {
    return false;
  }
  const record = error as { name?: unknown; status?: unknown; code?: unknown };
  return (
    record.name === "ApiError" &&
    typeof record.status === "number" &&
    typeof record.code === "string"
  );
}

export function toUserFacingAuthMessage(error: unknown): string {
  if (!isApiError(error)) {
    if (error instanceof TypeError) {
      return "Unable to connect. Please check your internet connection and try again.";
    }
    return "Something went wrong. Please try again.";
  }

  switch (error.code) {
    case "INVALID_CREDENTIALS":
      return "Invalid email or password.";
    case "CONFLICT":
      return "An account with this email already exists.";
    case "VALIDATION_ERROR":
      return error.message || "Please check your details and try again.";
    case "RATE_LIMITED":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "TOKEN_EXPIRED":
    case "TOKEN_INVALID":
    case "TOKEN_REVOKED":
    case "UNAUTHORIZED":
      return "Your session has expired. Please sign in again.";
    case "FORBIDDEN":
      return "Your session is no longer valid. Please sign in again.";
    case "NOT_IMPLEMENTED":
      return "This feature is not available yet.";
    case "RESET_TOKEN_INVALID":
      return "That reset code is invalid or expired. Request a new one.";
    case "NETWORK_ERROR":
      return "Unable to connect. Please check your internet connection and try again.";
    default:
      if (error.status === 403) {
        return "Your session is no longer valid. Please sign in again.";
      }
      if (error.status >= 500) {
        return "Something went wrong. Please try again.";
      }
      return "Something went wrong. Please try again.";
  }
}

function defaultCodeForStatus(status: number): string {
  switch (status) {
    case 400:
      return "VALIDATION_ERROR";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 409:
      return "CONFLICT";
    case 429:
      return "RATE_LIMITED";
    case 501:
      return "NOT_IMPLEMENTED";
    default:
      return status >= 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED";
  }
}

function defaultMessageForStatus(status: number): string {
  switch (status) {
    case 400:
      return "Invalid request data";
    case 401:
      return "Authentication required";
    case 403:
      return "You do not have permission to do that";
    case 409:
      return "Conflict";
    case 429:
      return "Too many requests";
    case 501:
      return "Not implemented";
    default:
      return status >= 500 ? "Internal server error" : "Request failed";
  }
}
