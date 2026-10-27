import { Router } from "express";

import { messageSendLimiter, mutationLimiter } from "../../infra/limiter/middleware";
import { authenticate } from "../../shared/middleware/authenticate";

import * as controller from "./controller";

/** Mounted at /stories. Photos and voice notes are uploaded first through POST /media/uploads. */
export const storiesRouter = Router();

storiesRouter.get("/feed", authenticate, controller.getFeed);
storiesRouter.post("/", authenticate, messageSendLimiter, controller.createStory);
storiesRouter.post("/:id/reply", authenticate, messageSendLimiter, controller.replyToStory);
storiesRouter.delete("/:id", authenticate, mutationLimiter, controller.deleteStory);
