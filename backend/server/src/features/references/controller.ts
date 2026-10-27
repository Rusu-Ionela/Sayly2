import type { Request, Response } from "express";
import { saveReferenceSchema } from "@sayly/shared";

import { requireUserId } from "../../shared/middleware/requireUserId";
import { recordReference } from "../notifications";

import { referencesPageQuerySchema, userIdParamSchema } from "./schema";
import * as referencesService from "./service";

/** GET /users/:userId/references — summary, newest first, and whether you can write one. */
export async function list(req: Request, res: Response) {
  const { userId } = userIdParamSchema.parse(req.params);
  const { page } = referencesPageQuerySchema.parse(req.query);
  res.json(await referencesService.listReferences(requireUserId(req), userId, page));
}

/** POST /users/:userId/references — leave or edit your reference. */
export async function save(req: Request, res: Response) {
  const { userId } = userIdParamSchema.parse(req.params);
  const input = saveReferenceSchema.parse(req.body);
  const authorId = requireUserId(req);
  const saved = await referencesService.saveReference(authorId, userId, input);
  recordReference(authorId, userId);
  res.status(201).json(saved);
}

/** DELETE /users/:userId/references — withdraw your reference. */
export async function remove(req: Request, res: Response) {
  const { userId } = userIdParamSchema.parse(req.params);
  res.json(await referencesService.deleteReference(requireUserId(req), userId));
}
