import { Router } from "express";

import { messageSendLimiter } from "../../infra/limiter/middleware";
import { authenticate } from "../../shared/middleware/authenticate";

import * as controller from "./controller";

/** Mounted at /icebreakers. Every route takes ?languageId= (or a body languageId). */
export const icebreakersRouter = Router();

icebreakersRouter.get("/today", authenticate, controller.getToday);
icebreakersRouter.get("/today/answers", authenticate, controller.listAnswers);
icebreakersRouter.put("/today/answer", authenticate, messageSendLimiter, controller.saveAnswer);
icebreakersRouter.delete("/today/answer", authenticate, messageSendLimiter, controller.deleteAnswer);
