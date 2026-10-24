import { Router } from "express";

import { mutationLimiter } from "../../infra/limiter/middleware";
import { authenticate } from "../../shared/middleware/authenticate";

import * as controller from "./controller";

/** Mounted at /users/:userId/references. :userId is the person the references are about. */
export const referencesRouter = Router({ mergeParams: true });

referencesRouter.get("/", authenticate, controller.list);
referencesRouter.post("/", authenticate, mutationLimiter, controller.save);
referencesRouter.delete("/", authenticate, mutationLimiter, controller.remove);
