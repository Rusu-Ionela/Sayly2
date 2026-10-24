import type { Request, Response } from "express";

import { env } from "../../config/env";
import { getRefreshTokenTtlMs } from "./tokens";

export const REFRESH_COOKIE_NAME = "sayly_refresh";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: (env.isProduction ? "none" : "lax") as "none" | "lax",
    path: "/auth",
    maxAge: getRefreshTokenTtlMs(),
  };
}

export function setRefreshCookie(res: Response, refreshToken: string) {
  const options = cookieOptions();
  const parts = [
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}`,
    `Path=${options.path}`,
    `Max-Age=${Math.floor(options.maxAge / 1000)}`,
    "HttpOnly",
    `SameSite=${options.sameSite === "none" ? "None" : "Lax"}`,
  ];
  if (options.secure) {
    parts.push("Secure");
  }
  res.append("Set-Cookie", parts.join("; "));
}

export function clearRefreshCookie(res: Response) {
  const options = cookieOptions();
  const parts = [
    `${REFRESH_COOKIE_NAME}=`,
    `Path=${options.path}`,
    "Max-Age=0",
    "HttpOnly",
    `SameSite=${options.sameSite === "none" ? "None" : "Lax"}`,
  ];
  if (options.secure) {
    parts.push("Secure");
  }
  res.append("Set-Cookie", parts.join("; "));
}

export function readRefreshCookie(req: Request): string | undefined {
  const header = req.get("cookie");
  if (!header) {
    return undefined;
  }
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === REFRESH_COOKIE_NAME) {
      const value = rest.join("=");
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return undefined;
}
