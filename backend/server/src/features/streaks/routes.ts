import { Router } from "express";

import { mutationLimiter } from "../../infra/limiter/middleware";
import { authenticate } from "../../shared/middleware/authenticate";

import * as controller from "./controller";

/** Mounted at /streaks. */
export const streaksRouter = Router();

streaksRouter.get("/me", authenticate, controller.getMyStreak);
streaksRouter.post("/me/check-in", authenticate, mutationLimiter, controller.checkIn);
