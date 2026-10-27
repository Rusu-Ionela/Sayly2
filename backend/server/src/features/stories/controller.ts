import type { Request, Response } from "express";
import { createStorySchema, storyReplySchema } from "@sayly/shared";

import { requireUserId } from "../../shared/middleware/requireUserId";
import { boundedIdSchema } from "../../shared/validation/text";

import * as service from "./service";

export async function createStory(req: Request, res: Response) {
  const input = createStorySchema.parse(req.body);
  res.status(201).json(await service.createStory(requireUserId(req), input));
}

export async function getFeed(req: Request, res: Response) {
  res.json(await service.getFeed(requireUserId(req)));
}

export async function replyToStory(req: Request, res: Response) {
  const id = boundedIdSchema.parse(req.params.id);
  const input = storyReplySchema.parse(req.body);
  res.status(201).json(await service.replyToStory(requireUserId(req), id, input));
}

export async function deleteStory(req: Request, res: Response) {
  const id = boundedIdSchema.parse(req.params.id);
  res.json(await service.deleteStory(requireUserId(req), id));
}
