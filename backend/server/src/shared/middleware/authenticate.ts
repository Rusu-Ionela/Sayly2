import type { NextFunction, Request, Response } from "express";

import { env } from "../../config/env";
import { findUserById } from "../../features/auth/repository";
import { verifyAccessToken } from "../../features/auth/tokens";
import { AppError } from "../errors/AppError";

import { createAuthUserCache } from "./authUserCache";

/** Upper bound on how stale a cached user can be if a revocation event is ever missed. */
const authUsers = createAuthUserCache({
  ttlMs: env.isTest ? 0 : 5_000,
  maxEntries: 5_000,
  load: findUserById,
});

/** Called on every revocation (password change, reset, logout, delete) so changes apply at once. */
export function invalidateAuthCache(userId: string) {
  authUsers.invalidate(userId);
}

function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

/**
 * Verifies the access token and attaches the identity to `req.user` — the single
 * source of truth read by `requireUserId()`. Returns false when the token is stale.
 */
async function attachUser(req: Request, token: string): Promise<boolean> {
  const payload = await verifyAccessToken(token);
  const user = await authUsers.get(payload.sub);

  if (!user || user.status !== "ACTIVE" || user.authVersion !== payload.authVersion) {
    return false;
  }

  req.user = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
  };
  req.authVersion = user.authVersion;
  req.accessTokenExpiresAt = payload.exp * 1000;
  return true;
}

/**
 * JWT Bearer authentication for the mobile API.
 * Access tokens are short-lived; refresh tokens are opaque and stored hashed in Postgres.
 * Cookie/CSRF is intentionally not used — clients send Authorization: Bearer <accessToken>.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req.get("authorization") ?? undefined);

    if (!token || !(await attachUser(req, token))) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    next();
  } catch (err) {
    next(err);
  }
}

/** Attach user when a Bearer token is present; otherwise continue anonymously. */
export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req.get("authorization") ?? undefined);
    if (token) {
      await attachUser(req, token);
    }
    next();
  } catch {
    // Invalid token on optional path → treat as anonymous.
    next();
  }
}
