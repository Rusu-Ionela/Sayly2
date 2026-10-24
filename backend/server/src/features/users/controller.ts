import type { Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../../shared/errors/AppError";
import { requireUserId } from "../../shared/middleware/requireUserId";
import { SAYLY_ID_PATTERN } from "../../shared/utils/saylyId";

import {
  changePasswordSchema,
  completeOnboardingSchema,
  onboardingDraftSchema,
  updateLanguagesSchema,
  updateProfileSchema,
  updateSettingsSchema,
} from "./schema";
import * as usersService from "./service";

function requireParam(value: string | string[] | undefined, name: string) {
  if (typeof value !== "string" || !value) {
    throw new AppError(`Missing ${name}`, 400, "VALIDATION_ERROR");
  }
  return value;
}

export async function getMe(req: Request, res: Response) {
  res.json(await usersService.getMe(requireUserId(req)));
}

export async function completeOnboarding(req: Request, res: Response) {
  const body = completeOnboardingSchema.parse(req.body);
  res.json(await usersService.completeOnboarding(requireUserId(req), body));
}

/** GET /users/me/onboarding-draft — resume incomplete setup. */
export async function getOnboardingDraft(req: Request, res: Response) {
  res.json(await usersService.getOnboardingDraft(requireUserId(req)));
}

/** PUT /users/me/onboarding-draft — replace the authenticated member's partial setup. */
export async function saveOnboardingDraft(req: Request, res: Response) {
  const body = onboardingDraftSchema.parse(req.body);
  res.json(await usersService.saveOnboardingDraft(requireUserId(req), body));
}

/** PRO-002 — PUT /users/me/profile (and legacy PATCH /users/me): same contract, same handler. */
export async function updateProfile(req: Request, res: Response) {
  const body = updateProfileSchema.parse(req.body);
  res.json(await usersService.updateProfile(requireUserId(req), body));
}

/** PATCH /users/me/settings — privacy and notification toggles. */
export async function updateSettings(req: Request, res: Response) {
  const body = updateSettingsSchema.parse(req.body);
  res.json(await usersService.updateSettings(requireUserId(req), body));
}

/** GET /users/me/export — JSON download of the member's own data. */
export async function exportMyData(req: Request, res: Response) {
  const data = await usersService.exportMyData(requireUserId(req));
  res.setHeader("Cache-Control", "no-store");
  res.json(data);
}

/** GET /users/by-sayly-id/:saylyId */
export async function findBySaylyId(req: Request, res: Response) {
  const saylyId = requireParam(req.params.saylyId, "saylyId").trim().toUpperCase();
  if (!SAYLY_ID_PATTERN.test(saylyId)) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }
  res.json(await usersService.findBySaylyId(requireUserId(req), saylyId));
}

export async function getUserById(req: Request, res: Response) {
  res.json(
    await usersService.getUserById(requireUserId(req), requireParam(req.params.id, "id")),
  );
}

/** PRO-001 GET /users/:id/public-profile */
export async function getPublicProfile(req: Request, res: Response) {
  res.json(
    await usersService.getPublicProfile(
      requireUserId(req),
      requireParam(req.params.id, "id"),
    ),
  );
}

const translateProfileSchema = z.object({ field: z.enum(["bio", "topics"]) });

/** POST /users/:id/translate — translate a public profile field for the viewer. */
export async function translateProfile(req: Request, res: Response) {
  const { field } = translateProfileSchema.parse(req.body);
  res.json(
    await usersService.translateProfileField(
      requireUserId(req),
      requireParam(req.params.id, "id"),
      field,
    ),
  );
}

export async function updateLanguages(req: Request, res: Response) {
  const body = updateLanguagesSchema.parse(req.body);
  res.json(await usersService.updateLanguages(requireUserId(req), body));
}

/** LANG-002P0 GET /users/me/languages */
export async function getMyLanguages(req: Request, res: Response) {
  res.json(await usersService.getMyLanguages(requireUserId(req)));
}

/** LANG-002P0 PUT /users/me/languages */
export async function putMyLanguages(req: Request, res: Response) {
  const body = updateLanguagesSchema.parse(req.body);
  res.json(await usersService.putMyLanguages(requireUserId(req), body));
}

export async function deleteMe(req: Request, res: Response) {
  res.json(await usersService.softDeleteAccount(requireUserId(req)));
}

export async function changePassword(req: Request, res: Response) {
  const body = changePasswordSchema.parse(req.body);
  res.json(
    await usersService.changePassword(
      requireUserId(req),
      body.currentPassword,
      body.newPassword,
    ),
  );
}
