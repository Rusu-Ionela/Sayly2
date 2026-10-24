import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate";
import { requireAdmin } from "../../shared/middleware/requireAdmin";
import { mutationLimiter, reportLimiter } from "../../infra/limiter/middleware";
import * as controller from "./controller";

export const blocksRouter = Router();
blocksRouter.get("/", authenticate, controller.listBlocks);
blocksRouter.post("/", authenticate, mutationLimiter, controller.createBlock);
blocksRouter.delete("/:userId", authenticate, mutationLimiter, controller.removeBlock);

export const reportsRouter = Router();
reportsRouter.post("/", authenticate, reportLimiter, controller.createReport);
reportsRouter.get("/admin", authenticate, requireAdmin, controller.listReports);
reportsRouter.patch("/:reportId/review", authenticate, requireAdmin, mutationLimiter, controller.reviewReport);
