import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../shared/errors/AppError";
import { consumeLimit, opaqueIdentity, rateLimitPolicies, trustedClientIp, type RateLimitPolicy } from "./limiter";

function clientIp(req: Request) {
  return trustedClientIp(req.ip);
}

function emailFromBody(req: Request): string {
  const email = req.body && typeof req.body === "object" && "email" in req.body ? req.body.email : "";
  return typeof email === "string" ? email : "";
}

export function limitByIp(policy: RateLimitPolicy) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await consumeLimit(policy, clientIp(req));
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function limitByUser(policy: RateLimitPolicy) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError("Authentication required", 401, "UNAUTHORIZED");
      }
      await consumeLimit(policy, userId);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function limitByHashedEmail(policy: RateLimitPolicy) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const email = emailFromBody(req);
      await consumeLimit(policy, opaqueIdentity(email || `missing:${clientIp(req)}`));
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const registerIpLimiter = limitByIp(rateLimitPolicies.registerIp);
export const loginIpLimiter = limitByIp(rateLimitPolicies.loginIp);
export const loginAccountLimiter = limitByHashedEmail(rateLimitPolicies.loginAccount);
export const resetIssueIpLimiter = limitByIp(rateLimitPolicies.resetIssueIp);
export const resetIssueAccountLimiter = limitByHashedEmail(rateLimitPolicies.resetIssueAccount);
export const resetVerifyIpLimiter = limitByIp(rateLimitPolicies.resetVerifyIp);
export const refreshIpLimiter = limitByIp(rateLimitPolicies.refreshIp);
export const logoutIpLimiter = limitByIp(rateLimitPolicies.logoutIp);
export const passwordChangeLimiter = limitByUser(rateLimitPolicies.passwordChange);
export const messageSendLimiter = limitByUser(rateLimitPolicies.messageSend);
export const uploadLimiter = limitByUser(rateLimitPolicies.upload);
export const translateLimiter = limitByUser(rateLimitPolicies.translate);
export const transcribeLimiter = limitByUser(rateLimitPolicies.transcribe);
export const reportLimiter = limitByUser(rateLimitPolicies.report);
export const mutationLimiter = limitByUser(rateLimitPolicies.mutation);
export const discoveryLimiter = limitByUser(rateLimitPolicies.discovery);
export const groupCreateLimiter = limitByUser(rateLimitPolicies.groupCreate);
export const groupActionLimiter = limitByUser(rateLimitPolicies.groupAction);
export const dataExportLimiter = limitByUser(rateLimitPolicies.dataExport);
export const supportTicketLimiter = limitByUser(rateLimitPolicies.supportTicket);
