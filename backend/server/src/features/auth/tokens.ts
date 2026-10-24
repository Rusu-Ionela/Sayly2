import { createHmac, createHash, randomBytes, randomInt, randomUUID } from "crypto";

import { SignJWT, jwtVerify, errors as joseErrors } from "jose";

import { env } from "../../config/env";
import { AppError } from "../../shared/errors/AppError";

const accessSecret = () => new TextEncoder().encode(env.jwtAccessSecret);

function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());

  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "s":
      return amount;
    case "m":
      return amount * 60;
    case "h":
      return amount * 60 * 60;
    case "d":
      return amount * 60 * 60 * 24;
    default:
      throw new Error(`Invalid duration unit: ${unit}`);
  }
}

export function getRefreshTokenTtlMs(): number {
  return parseDurationToSeconds(env.jwtRefreshExpiresIn) * 1000;
}

export function getPasswordResetTtlMs(): number {
  return parseDurationToSeconds(env.passwordResetExpiresIn) * 1000;
}

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: string;
  authVersion: number;
  exp: number;
  familyId?: string;
};

export async function signAccessToken(payload: {
  sub: string;
  email: string;
  role: string;
  authVersion: number;
  familyId?: string;
}): Promise<string> {
  const token = new SignJWT({
    email: payload.email,
    role: payload.role,
    av: payload.authVersion,
    ...(payload.familyId ? { fid: payload.familyId } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(env.jwtIssuer)
    .setAudience(env.jwtAudience)
    .setIssuedAt()
    .setExpirationTime(env.jwtAccessExpiresIn)
    .setJti(randomUUID());

  return token.sign(accessSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  if (!token || token.length > 8192) {
    throw new AppError("Invalid access token", 401, "TOKEN_INVALID");
  }

  try {
    const { payload } = await jwtVerify(token, accessSecret(), {
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
      algorithms: ["HS256"],
      requiredClaims: ["sub", "exp", "iat", "iss", "aud"],
    });

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new AppError("Invalid access token", 401, "TOKEN_INVALID");
    }
    if (typeof payload.email !== "string") {
      throw new AppError("Invalid access token", 401, "TOKEN_INVALID");
    }
    if (typeof payload.exp !== "number") {
      throw new AppError("Invalid access token", 401, "TOKEN_INVALID");
    }

    const authVersion = typeof payload.av === "number" ? payload.av : 0;

    return {
      sub: payload.sub,
      email: payload.email,
      role: typeof payload.role === "string" ? payload.role : "USER",
      authVersion,
      exp: payload.exp,
      familyId: typeof payload.fid === "string" ? payload.fid : undefined,
    };
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    if (err instanceof joseErrors.JWTExpired) {
      throw new AppError("Access token expired", 401, "TOKEN_EXPIRED");
    }

    throw new AppError("Invalid access token", 401, "TOKEN_INVALID");
  }
}

export function createRefreshTokenValue(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetCode(): string {
  // 8 digits + challengeId binding keeps codes short for email UX while raising entropy.
  return String(randomInt(0, 100_000_000)).padStart(8, "0");
}

export function createResetChallengeId(): string {
  return randomBytes(32).toString("base64url");
}

export function hashResetChallengeId(challengeId: string): string {
  return createHash("sha256").update(challengeId).digest("hex");
}

export function digestResetCode(challengeId: string, code: string): string {
  return createHmac("sha256", env.resetCodePepper)
    .update(challengeId)
    .update("\0")
    .update(code)
    .digest("hex");
}

export function createFamilyId(): string {
  return randomUUID();
}
