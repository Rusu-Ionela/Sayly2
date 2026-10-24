import type { Request } from "express";

import { env } from "../../config/env";
import { AppError } from "../../shared/errors/AppError";

/**
 * Cookie-based refresh/logout are cross-site CSRF risks when SameSite=None.
 * Require Origin (or Referer) to match configured CLIENT_ORIGIN values.
 * Native clients that send refreshToken in the JSON body skip this check.
 */
export function assertTrustedAuthOrigin(req: Request) {
  const origin = req.get("origin")?.trim();
  if (origin) {
    if (env.clientOrigins.includes(origin)) {
      return;
    }
    throw new AppError("Untrusted origin for cookie auth", 403, "FORBIDDEN");
  }

  const referer = req.get("referer")?.trim();
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (env.clientOrigins.includes(refererOrigin)) {
        return;
      }
    } catch {
      // fall through
    }
    throw new AppError("Untrusted referer for cookie auth", 403, "FORBIDDEN");
  }

  // Non-browser clients (no Origin/Referer) should use body refresh tokens.
  if (env.isProduction) {
    throw new AppError("Origin required for cookie auth", 403, "FORBIDDEN");
  }
}
