import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate";

import * as controller from "./controller";

export const topicsRouter = Router();

topicsRouter.get("/", authenticate, controller.listTopics);
topicsRouter.post("/", authenticate, controller.createTopic);
topicsRouter.patch("/:topicId", authenticate, controller.updateTopic);
topicsRouter.delete("/:topicId", authenticate, controller.deleteTopic);
