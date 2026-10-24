import type { NextFunction, Request, Response } from "express";

import { requireUserId } from "../../shared/middleware/requireUserId";

import { createOwnedUpload } from "./service";

export async function createUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await createOwnedUpload(requireUserId(req), req.file);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
