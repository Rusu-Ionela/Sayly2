import { Router } from "express";

import * as controller from "./controller";

export const languagesRouter = Router();

languagesRouter.get("/", controller.listLanguages);
