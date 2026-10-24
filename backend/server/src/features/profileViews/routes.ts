import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate";

import * as controller from "./controller";

export const profileViewsRouter = Router();

profileViewsRouter.get("/visitors", authenticate, controller.listVisitors);
profileViewsRouter.post("/visitors/seen", authenticate, controller.markVisitorsSeen);
profileViewsRouter.get("/viewed", authenticate, controller.listViewed);
