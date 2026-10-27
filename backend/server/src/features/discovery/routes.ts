import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate";
import { discoveryLimiter } from "../../infra/limiter/middleware";
import * as controller from "./controller";

export const discoveryRouter = Router();

discoveryRouter.get("/", authenticate, discoveryLimiter, controller.discover);
discoveryRouter.get("/radar", authenticate, discoveryLimiter, controller.radar);
discoveryRouter.get("/users/:id", authenticate, discoveryLimiter, controller.getDiscoverUser);
