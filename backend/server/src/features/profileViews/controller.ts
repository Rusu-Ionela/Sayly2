import type { Request, Response } from "express";

import { requireUserId } from "../../shared/middleware/requireUserId";
import { pageQuerySchema } from "../../shared/validation/pageQuery";

import * as viewsService from "./service";

/** GET /profile-views/visitors */
export async function listVisitors(req: Request, res: Response) {
  res.json(await viewsService.listVisitors(requireUserId(req), pageQuerySchema.parse(req.query)));
}

/** POST /profile-views/visitors/seen */
export async function markVisitorsSeen(req: Request, res: Response) {
  res.json(await viewsService.markVisitorsSeen(requireUserId(req)));
}

/** GET /profile-views/viewed */
export async function listViewed(req: Request, res: Response) {
  res.json(await viewsService.listViewed(requireUserId(req), pageQuerySchema.parse(req.query)));
}
