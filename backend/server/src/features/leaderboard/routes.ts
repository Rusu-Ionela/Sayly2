import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate";

import * as controller from "./controller";

/** Mounted at /leaderboard. */
export const leaderboardRouter = Router();

leaderboardRouter.get("/friends", authenticate, controller.getFriendsLeaderboard);
