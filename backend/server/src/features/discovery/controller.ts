import type { Request, Response } from "express";

import { AppError } from "../../shared/errors/AppError";
import { requireUserId } from "../../shared/middleware/requireUserId";

import { discoverQuerySchema } from "./schema";
import * as discoveryService from "./service";

/** GET /discover — DISC-001 / DISC-002 / DISC-003 / DISC-004 / DISC-005. */
export async function discover(req: Request, res: Response) {
  const filters = discoverQuerySchema.parse(req.query);
  const viewerId = requireUserId(req);
  res.json(await discoveryService.discover(viewerId, filters));
}

/** GET /discover/users/:id — DISC-006 alias of GET /users/:id/public-profile. */
export async function getDiscoverUser(req: Request, res: Response) {
  const userId = req.params.id;
  if (typeof userId !== "string" || !userId) {
    throw new AppError("Missing id", 400, "VALIDATION_ERROR");
  }
  res.json(await discoveryService.getDiscoverUser(requireUserId(req), userId));
}
