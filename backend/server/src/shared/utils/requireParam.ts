import type { Request } from "express";

import { AppError } from "../errors/AppError";

/** Route ids are cuid2/ISO strings — reject anything else before it reaches a query. */
export function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw new AppError(`Invalid ${name}`, 400, "VALIDATION_ERROR");
  }
  return value;
}
