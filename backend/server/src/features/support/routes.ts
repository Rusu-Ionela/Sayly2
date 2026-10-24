import { Router } from "express";

import { supportTicketLimiter } from "../../infra/limiter/middleware";
import { authenticate } from "../../shared/middleware/authenticate";

import * as controller from "./controller";

export const supportRouter = Router();

supportRouter.get("/tickets", authenticate, controller.listTickets);
supportRouter.post("/tickets", authenticate, supportTicketLimiter, controller.createTicket);
supportRouter.post("/bug-report", authenticate, supportTicketLimiter, controller.createFeedback("BUG_REPORT"));
supportRouter.post(
  "/feature-request",
  authenticate,
  supportTicketLimiter,
  controller.createFeedback("FEATURE_REQUEST"),
);
