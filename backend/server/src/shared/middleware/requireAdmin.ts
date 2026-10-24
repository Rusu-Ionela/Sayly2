import type { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/AppError";

/** Requires an authenticated administrator. `authenticate` reloads this role from Postgres. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    next(new AppError("Administrator access required", 403, "FORBIDDEN"));
    return;
  }
  next();
}
