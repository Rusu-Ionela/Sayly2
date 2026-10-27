import type { Request, Response } from "express";
import { icebreakerAnswerSchema, icebreakerLanguageQuerySchema } from "@sayly/shared";

import { requireUserId } from "../../shared/middleware/requireUserId";
import { boundedIdSchema } from "../../shared/validation/text";

import * as service from "./service";

const answersQuerySchema = icebreakerLanguageQuerySchema.extend({
  cursor: boundedIdSchema.optional(),
});

export async function getToday(req: Request, res: Response) {
  const { languageId } = icebreakerLanguageQuerySchema.parse(req.query);
  res.json(await service.getToday(requireUserId(req), languageId));
}

export async function listAnswers(req: Request, res: Response) {
  const { languageId, cursor } = answersQuerySchema.parse(req.query);
  res.json(await service.listAnswers(requireUserId(req), languageId, cursor));
}

export async function saveAnswer(req: Request, res: Response) {
  const input = icebreakerAnswerSchema.parse(req.body);
  res.json(await service.saveAnswer(requireUserId(req), input));
}

export async function deleteAnswer(req: Request, res: Response) {
  const { languageId } = icebreakerLanguageQuerySchema.parse(req.query);
  res.json(await service.deleteAnswer(requireUserId(req), languageId));
}
