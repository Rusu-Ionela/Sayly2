import type { NextFunction, Request, Response } from "express";

import type { AuthenticatedUser } from "../features/auth/types";
import { AppError } from "../shared/errors/AppError";

/** Fixed viewer used by route tests that mock the authenticate middleware. */
export const TEST_VIEWER_ID = "viewer-1";

const testUser: AuthenticatedUser = {
  id: TEST_VIEWER_ID,
  email: "viewer@test.invalid",
  displayName: "Viewer",
  role: "USER",
  status: "ACTIVE",
};
const adminUser: AuthenticatedUser = { ...testUser, id: "admin-1", email: "admin@test.invalid", role: "ADMIN" };

function userFor(req: Request) {
  return req.get("authorization") === "Bearer admin" ? adminUser : testUser;
}

/**
 * Drop-in replacement for `shared/middleware/authenticate` in route tests:
 * `vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"))`.
 * Mirrors production: only `req.user` carries the identity.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  if (!req.get("authorization")) {
    next(new AppError("Authentication required", 401, "UNAUTHORIZED"));
    return;
  }
  req.user = userFor(req);
  next();
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  if (req.get("authorization")) {
    req.user = userFor(req);
  }
  next();
}
