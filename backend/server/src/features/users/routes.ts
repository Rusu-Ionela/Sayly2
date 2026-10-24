import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate";
import {
  dataExportLimiter,
  mutationLimiter,
  passwordChangeLimiter,
  translateLimiter,
} from "../../infra/limiter/middleware";
import { referencesRouter } from "../references";

import * as controller from "./controller";

export const usersRouter = Router();

usersRouter.get("/me", authenticate, controller.getMe);
usersRouter.get("/me/onboarding-draft", authenticate, controller.getOnboardingDraft);
usersRouter.put("/me/onboarding-draft", authenticate, controller.saveOnboardingDraft);
usersRouter.put("/me/onboarding", authenticate, controller.completeOnboarding);
usersRouter.put("/me/profile", authenticate, controller.updateProfile);
usersRouter.patch("/me", authenticate, controller.updateProfile);
usersRouter.patch("/me/settings", authenticate, controller.updateSettings);
usersRouter.patch("/me/password", authenticate, passwordChangeLimiter, controller.changePassword);
usersRouter.delete("/me", authenticate, controller.deleteMe);
usersRouter.get("/me/export", authenticate, dataExportLimiter, controller.exportMyData);
usersRouter.get("/me/languages", authenticate, controller.getMyLanguages);
usersRouter.put("/me/languages", authenticate, controller.putMyLanguages);
usersRouter.patch("/me/languages", authenticate, controller.updateLanguages);
usersRouter.get("/by-sayly-id/:saylyId", authenticate, mutationLimiter, controller.findBySaylyId);
usersRouter.use("/:userId/references", referencesRouter);
// PRO-001 must be registered before /:id so "public-profile" is not captured as an id.
usersRouter.get("/:id/public-profile", authenticate, controller.getPublicProfile);
usersRouter.post("/:id/translate", authenticate, translateLimiter, controller.translateProfile);
usersRouter.get("/:id", authenticate, controller.getUserById);
