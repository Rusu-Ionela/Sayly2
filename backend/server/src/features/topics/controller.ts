import type { Request, Response } from "express";

import { requireUserId } from "../../shared/middleware/requireUserId";
import { requireParam } from "../../shared/utils/requireParam";

import { createTopicSchema, updateTopicSchema } from "./schema";
import * as topicsService from "./service";

/** GET /topics — your conversation topics. */
export async function listTopics(req: Request, res: Response) {
  res.json(await topicsService.listTopics(requireUserId(req)));
}

/** POST /topics */
export async function createTopic(req: Request, res: Response) {
  const body = createTopicSchema.parse(req.body);
  res.status(201).json(await topicsService.createTopic(requireUserId(req), body));
}

/** PATCH /topics/:topicId — make it the main topic. */
export async function updateTopic(req: Request, res: Response) {
  updateTopicSchema.parse(req.body);
  res.json(await topicsService.setMainTopic(requireUserId(req), requireParam(req, "topicId")));
}

/** DELETE /topics/:topicId */
export async function deleteTopic(req: Request, res: Response) {
  res.json(await topicsService.deleteTopic(requireUserId(req), requireParam(req, "topicId")));
}
