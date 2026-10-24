import type { Request } from "express";

import { AppError } from "../errors/AppError";

/** Resolves the authenticated user id set by `authenticate` — `req.user` is the single source of truth. */
export function requireUserId(req: Request): string {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  }
  return userId;
}
