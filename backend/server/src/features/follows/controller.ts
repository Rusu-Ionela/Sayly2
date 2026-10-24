import type { Request, Response } from "express";
import { z } from "zod";

import { boundedIdSchema } from "../../shared/validation/text";
import { requireUserId } from "../../shared/middleware/requireUserId";

import * as repository from "./repository";

const userIdParamSchema = z.object({ userId: boundedIdSchema });
const listQuerySchema = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1) });

export async function follow(req: Request, res: Response) {
  const { userId } = userIdParamSchema.parse(req.params);
  const followerId = requireUserId(req);
  const result = await repository.followUser(followerId, userId);
  res.json(result);
}

export async function unfollow(req: Request, res: Response) {
  const { userId } = userIdParamSchema.parse(req.params);
  res.json(await repository.unfollowUser(requireUserId(req), userId));
}

export async function listFollowing(req: Request, res: Response) {
  const { page } = listQuerySchema.parse(req.query);
  res.json(await repository.listFollowing(requireUserId(req), page));
}
