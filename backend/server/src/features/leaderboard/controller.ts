import type { Request, Response } from "express";

import { requireUserId } from "../../shared/middleware/requireUserId";

import * as service from "./service";

export async function getFriendsLeaderboard(req: Request, res: Response) {
  res.json(await service.getFriendsLeaderboard(requireUserId(req)));
}
