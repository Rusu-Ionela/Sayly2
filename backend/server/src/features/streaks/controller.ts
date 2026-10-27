import type { Request, Response } from "express";
import { z } from "zod";

import { requireUserId } from "../../shared/middleware/requireUserId";

import * as service from "./service";
import { isValidTimeZone } from "./timezone";

const checkInSchema = z
  .object({
    timezone: z.string().trim().refine(isValidTimeZone, "Unknown time zone").optional(),
  })
  .strict();

export async function getMyStreak(req: Request, res: Response) {
  res.json(await service.getStreak(requireUserId(req)));
}

/** The app calls this when it opens or returns to the foreground. */
export async function checkIn(req: Request, res: Response) {
  const { timezone } = checkInSchema.parse(req.body ?? {});
  res.json(await service.recordActivity(requireUserId(req), timezone));
}
