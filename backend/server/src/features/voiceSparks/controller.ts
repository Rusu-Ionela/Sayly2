import type { Request, Response } from "express";
import { createVoiceSparkSchema } from "@sayly/shared";

import { requireUserId } from "../../shared/middleware/requireUserId";
import { boundedIdSchema } from "../../shared/validation/text";

import * as service from "./service";

export async function createSpark(req: Request, res: Response) {
  const input = createVoiceSparkSchema.parse(req.body);
  res.status(201).json(await service.createSpark(requireUserId(req), input));
}

export async function getFeed(req: Request, res: Response) {
  res.json(await service.getFeed(requireUserId(req)));
}

export async function deleteSpark(req: Request, res: Response) {
  const id = boundedIdSchema.parse(req.params.id);
  res.json(await service.deleteSpark(requireUserId(req), id));
}
