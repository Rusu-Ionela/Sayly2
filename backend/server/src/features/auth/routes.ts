import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate";
import {
  loginAccountLimiter,
  loginIpLimiter,
  logoutIpLimiter,
  refreshIpLimiter,
  registerIpLimiter,
  resetIssueAccountLimiter,
  resetIssueIpLimiter,
  resetVerifyIpLimiter,
} from "../../infra/limiter/middleware";
import * as controller from "./controller";

export const authRouter = Router();

authRouter.post("/register", registerIpLimiter, controller.register);
authRouter.post("/login", loginIpLimiter, loginAccountLimiter, controller.login);
authRouter.post("/refresh", refreshIpLimiter, controller.refresh);
authRouter.post("/logout", logoutIpLimiter, controller.logout);
authRouter.get("/me", authenticate, controller.me);
authRouter.post("/forgot-password", resetIssueIpLimiter, resetIssueAccountLimiter, controller.forgotPassword);
authRouter.post("/reset-password", resetVerifyIpLimiter, controller.resetPassword);
