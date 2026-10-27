import type { Request, Response } from "express";
import { flashQuestMessageSchema, startFlashQuestSchema } from "@sayly/shared";

import { requireUserId } from "../../shared/middleware/requireUserId";
import { boundedIdSchema } from "../../shared/validation/text";

import * as service from "./service";

export async function startQuest(req: Request, res: Response) {
  const { languageId } = startFlashQuestSchema.parse(req.body);
  res.json(await service.startQuest(requireUserId(req), languageId));
}

export async function getQuest(req: Request, res: Response) {
  res.json(await service.getQuest(requireUserId(req), boundedIdSchema.parse(req.params.id)));
}

export async function leaveQuest(req: Request, res: Response) {
  res.json(await service.leaveQuest(requireUserId(req), boundedIdSchema.parse(req.params.id)));
}

export async function sendMessage(req: Request, res: Response) {
  const { body } = flashQuestMessageSchema.parse(req.body);
  res.json(await service.sendMessage(requireUserId(req), boundedIdSchema.parse(req.params.id), body));
}

export async function chooseToConnect(req: Request, res: Response) {
  res.json(await service.chooseToConnect(requireUserId(req), boundedIdSchema.parse(req.params.id)));
}
