import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate";

import * as controller from "./controller";

export const locationsRouter = Router();

locationsRouter.get("/countries/:country/cities", authenticate, controller.listCities);
