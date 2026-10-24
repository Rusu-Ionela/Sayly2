import type { Request, Response } from "express";

import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from "./cookies";
import { assertTrustedAuthOrigin } from "./csrf";
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from "./schema";
import * as authService from "./service";
import type { RequestMeta } from "./types";

function requestMeta(req: Request): RequestMeta {
  return {
    userAgent: req.get("user-agent")?.slice(0, 512),
    ip: req.ip,
  };
}

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const session = await authService.register(input, requestMeta(req));
  setRefreshCookie(res, session.refreshToken);
  res.status(201).json(session);
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const session = await authService.login(input, requestMeta(req));
  setRefreshCookie(res, session.refreshToken);
  res.json(session);
}

export async function refresh(req: Request, res: Response) {
  const cookieToken = readRefreshCookie(req);
  const bodyToken =
    typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;
  if (cookieToken && !bodyToken) {
    assertTrustedAuthOrigin(req);
  }
  const refreshToken = bodyToken || cookieToken;
  const input = refreshSchema.parse({ refreshToken });
  const session = await authService.refresh(input, requestMeta(req));
  setRefreshCookie(res, session.refreshToken);
  res.json(session);
}

export async function logout(req: Request, res: Response) {
  const cookieToken = readRefreshCookie(req);
  const bodyToken =
    typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;
  if (cookieToken && !bodyToken) {
    assertTrustedAuthOrigin(req);
  }
  const refreshToken = bodyToken || cookieToken;
  const input = logoutSchema.parse({ refreshToken });
  const result = await authService.logout(input);
  clearRefreshCookie(res);
  res.json(result);
}

export async function me(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
    return;
  }

  const result = await authService.getMe(req.user.id);
  res.json(result);
}

export async function forgotPassword(req: Request, res: Response) {
  const input = forgotPasswordSchema.parse(req.body);
  const result = await authService.forgotPassword(input);
  res.json(result);
}

export async function resetPassword(req: Request, res: Response) {
  const input = resetPasswordSchema.parse(req.body);
  const result = await authService.resetPassword(input);
  res.json(result);
}
