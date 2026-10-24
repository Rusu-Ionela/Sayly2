import { Router } from "express";

import { mutationLimiter } from "../../infra/limiter/middleware";
import { authenticate } from "../../shared/middleware/authenticate";

import * as controller from "./controller";

/** Mounted at /connections. Requests are explicit consent before direct messaging. */
export const connectionsRouter = Router();

connectionsRouter.get("/", authenticate, controller.listConnections);
connectionsRouter.get("/with/:userId", authenticate, controller.getConnection);
connectionsRouter.post("/:userId", authenticate, mutationLimiter, controller.requestConnection);
connectionsRouter.patch("/:id", authenticate, mutationLimiter, controller.respondToConnection);
