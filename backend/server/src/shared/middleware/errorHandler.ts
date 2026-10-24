import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { env } from "../../config/env";
import { dbFailureToAppError } from "../../db/errors";
import { AppError } from "../errors/AppError";
import { logger } from "../utils/logger";

type ErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
};

function zodFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of err.issues) {
    const path = issue.path.join(".") || "_root";
    if (!fields[path]) {
      fields[path] = issue.message;
    }
  }

  return fields;
}

function sendError(res: Response, statusCode: number, body: ErrorBody) {
  res.status(statusCode).json(body);
}

function bodyParserCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") {
    return undefined;
  }
  if ("type" in err && typeof err.type === "string") {
    return err.type;
  }
  return undefined;
}

export function errorHandler(rawErr: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    next(rawErr);
    return;
  }
  const err = dbFailureToAppError(rawErr) ?? rawErr;

  const parserType = bodyParserCode(err);
  if (parserType === "entity.parse.failed") {
    sendError(res, 400, {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Malformed JSON body" },
    });
    return;
  }
  if (parserType === "entity.too.large") {
    sendError(res, 413, {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Request body is too large" },
    });
    return;
  }

  if (err instanceof AppError) {
    logger.warn("error", "application error", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: err.statusCode,
      code: err.code,
    });

    if (err.retryAfterSeconds) {
      res.setHeader("Retry-After", String(err.retryAfterSeconds));
    }

    sendError(res, err.statusCode, {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.fields ? { fields: err.fields } : {}),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    const fields = zodFields(err);

    logger.warn("error", "validation error", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      fields,
    });

    sendError(res, 400, {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        fields,
      },
    });
    return;
  }

  logger.error("error", "unhandled error", {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    name: err instanceof Error ? err.name : "UnknownError",
    // Server log only (never sent to the client): the real reason and where it was thrown.
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    ...(err instanceof Error && err.cause instanceof Error
      ? { cause: err.cause.message, causeStack: err.cause.stack }
      : {}),
  });
  // Local runs: also print the error as-is, so the stack trace is readable in the terminal.
  if (env.enableDevLogs && !env.isTest) {
    console.error(err);
  }

  sendError(res, 500, {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      ...(!env.exposeErrorDetails
        ? {}
        : {
            fields: {
              detail: err instanceof Error ? err.message : "Unknown error",
              // Drizzle wraps the driver error ("Failed query: ...") and keeps the real reason here.
              ...(err instanceof Error && err.cause instanceof Error
                ? { cause: err.cause.message }
                : {}),
            },
          }),
    },
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `No route for ${req.method} ${req.path}`,
    },
  });
}
