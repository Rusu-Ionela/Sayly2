import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate";
import { discoveryLimiter } from "../../infra/limiter/middleware";
import * as controller from "./controller";

export const discoveryRouter = Router();

discoveryRouter.get("/", authenticate, discoveryLimiter, controller.discover);
discoveryRouter.get("/users/:id", authenticate, discoveryLimiter, controller.getDiscoverUser);
