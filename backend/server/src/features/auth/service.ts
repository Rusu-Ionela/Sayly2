import { isUniqueViolation } from "../../db/errors";
import { revokeFamilySockets, revokeUserSockets } from "../../lib/sessionRevocation";
import { AppError } from "../../shared/errors/AppError";
import { logger, maskEmail } from "../../shared/utils/logger";
import { hashPassword, verifyPasswordOrDummy } from "./password";
import * as repository from "./repository";
import type {
  ForgotPasswordInput,
  LoginInput,
  LogoutInput,
  RefreshInput,
  RegisterInput,
  ResetPasswordInput,
} from "./schema";
import {
  createFamilyId,
  createPasswordResetCode,
  createRefreshTokenValue,
  createResetChallengeId,
  digestResetCode,
  getPasswordResetTtlMs,
  getRefreshTokenTtlMs,
  hashRefreshToken,
  hashResetChallengeId,
  signAccessToken,
} from "./tokens";
import type { AuthSession, RequestMeta } from "./types";
import { toAuthUser } from "./types";
import { sendPasswordResetEmail } from "./mail";

const INVALID_CREDENTIALS = "Invalid email or password";

/** Auth payload with name, bio and avatar taken from Profile when it exists. */
async function authUserFor(user: repository.User) {
  return toAuthUser(user, await repository.findProfileIdentity(user.id));
}
const RESET_INVALID = "Invalid or expired reset token";

async function issueSession(
  user: repository.User,
  meta: RequestMeta,
  familyId = createFamilyId(),
): Promise<AuthSession> {
  const refreshToken = createRefreshTokenValue();
  const tokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + getRefreshTokenTtlMs());

  await repository.createRefreshToken({
    userId: user.id,
    tokenHash,
    familyId,
    expiresAt,
    userAgent: meta.userAgent,
    ip: meta.ip,
  });

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    authVersion: user.authVersion,
    familyId,
  });

  return {
    accessToken,
    refreshToken,
    user: await authUserFor(user),
  };
}

export async function register(input: RegisterInput, meta: RequestMeta = {}): Promise<AuthSession> {
  const existing = await repository.findUserByEmail(input.email);

  if (existing) {
    throw new AppError("An account with this email already exists", 409, "CONFLICT");
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const refreshToken = createRefreshTokenValue();
    const familyId = createFamilyId();
    const { user } = await repository.createUserWithRefreshToken(
      {
        email: input.email,
        passwordHash,
        displayName: input.displayName,
      },
      {
        tokenHash: hashRefreshToken(refreshToken),
        familyId,
        expiresAt: new Date(Date.now() + getRefreshTokenTtlMs()),
        userAgent: meta.userAgent,
        ip: meta.ip,
      },
    );

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      authVersion: user.authVersion,
      familyId,
    });

    logger.info("auth", "user registered", { userId: user.id, email: maskEmail(user.email) });

    return {
      accessToken,
      refreshToken,
      user: toAuthUser(user),
    };
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError("An account with this email already exists", 409, "CONFLICT");
    }

    throw err;
  }
}

export async function login(input: LoginInput, meta: RequestMeta = {}): Promise<AuthSession> {
  const user = await repository.findUserByEmail(input.email);
  const active = user && user.status === "ACTIVE" ? user : null;
  const passwordOk = await verifyPasswordOrDummy(active?.passwordHash, input.password);

  if (!active || !passwordOk) {
    logger.info("auth", "login failed", {
      reason: active ? "bad_password" : "user_missing_or_inactive",
      email: maskEmail(input.email),
    });
    throw new AppError(INVALID_CREDENTIALS, 401, "INVALID_CREDENTIALS");
  }

  const session = await issueSession(active, meta);
  logger.info("auth", "login success", { userId: active.id, email: maskEmail(active.email) });
  return session;
}

export async function refresh(input: RefreshInput, meta: RequestMeta = {}): Promise<AuthSession> {
  const tokenHash = hashRefreshToken(input.refreshToken);
  const newRefreshToken = createRefreshTokenValue();
  const result = await repository.rotateRefreshTokenAtomic({
    previousTokenHash: tokenHash,
    nextTokenHash: hashRefreshToken(newRefreshToken),
    expiresAt: new Date(Date.now() + getRefreshTokenTtlMs()),
    userAgent: meta.userAgent,
    ip: meta.ip,
  });

  if (result.status === "invalid") {
    throw new AppError("Invalid refresh token", 401, "TOKEN_INVALID");
  }

  if (result.status === "revoked") {
    logger.warn("auth", "refresh token reuse detected", {
      userId: result.userId,
      familyId: result.familyId,
    });
    revokeUserSockets(result.userId);
    throw new AppError("Refresh token has been revoked", 401, "TOKEN_REVOKED");
  }

  if (result.status === "expired") {
    throw new AppError("Refresh token expired", 401, "TOKEN_EXPIRED");
  }

  if (result.status === "inactive") {
    revokeUserSockets(result.userId);
    throw new AppError("Account is not active", 403, "FORBIDDEN");
  }

  const accessToken = await signAccessToken({
    sub: result.user.id,
    email: result.user.email,
    role: result.user.role,
    authVersion: result.user.authVersion,
    familyId: result.familyId,
  });

  logger.info("auth", "refresh rotated", { userId: result.user.id });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: await authUserFor(result.user),
  };
}

export async function logout(input: LogoutInput): Promise<{ ok: true }> {
  const tokenHash = hashRefreshToken(input.refreshToken);
  const existing = await repository.findRefreshTokenByHash(tokenHash);

  if (existing && !existing.revokedAt) {
    await repository.revokeRefreshTokenFamily(existing.familyId);
    revokeFamilySockets(existing.userId, existing.familyId);
    logger.info("auth", "logout", { userId: existing.userId, familyId: existing.familyId });
  }

  return { ok: true };
}

export async function getMe(userId: string): Promise<{ user: ReturnType<typeof toAuthUser> }> {
  const user = await repository.findUserById(userId);

  if (!user || user.status !== "ACTIVE") {
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  }

  return { user: await authUserFor(user) };
}

export type ForgotPasswordResult = {
  ok: true;
  challengeId: string;
  expiresInSeconds: number;
};

export async function forgotPassword(input: ForgotPasswordInput): Promise<ForgotPasswordResult> {
  const challengeId = createResetChallengeId();
  const expiresInSeconds = Math.floor(getPasswordResetTtlMs() / 1000);
  const user = await repository.findUserByEmail(input.email);

  if (!user || user.status !== "ACTIVE") {
    return { ok: true, challengeId, expiresInSeconds };
  }

  const code = createPasswordResetCode();
  const expiresAt = new Date(Date.now() + getPasswordResetTtlMs());

  try {
    await repository.issuePasswordResetChallenge({
      userId: user.id,
      challengeHash: hashResetChallengeId(challengeId),
      tokenHash: digestResetCode(challengeId, code),
      expiresAt,
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "RATE_LIMITED") {
      return { ok: true, challengeId, expiresInSeconds };
    }
    throw error;
  }

  // Not awaited: waiting on SMTP would make real accounts answer slower (or fail) than unknown emails.
  void repository
    .findProfileIdentity(user.id)
    .then((profile) =>
      sendPasswordResetEmail({
        to: user.email,
        displayName: profile?.displayName || user.displayName,
        code,
        expiresInSeconds,
        challengeId,
      }),
    )
    .catch((error: unknown) => {
      logger.error("auth", "password reset email failed", {
        userId: user.id,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    });

  logger.info("auth", "password reset issued", { userId: user.id, email: maskEmail(user.email) });

  return { ok: true, challengeId, expiresInSeconds };
}

export async function resetPassword(input: ResetPasswordInput): Promise<{ ok: true }> {
  const passwordHash = await hashPassword(input.password);
  const result = await repository.consumePasswordResetChallenge({
    challengeHash: hashResetChallengeId(input.challengeId),
    codeDigest: digestResetCode(input.challengeId, input.token),
    passwordHash,
  });

  if (result.status === "ok") {
    revokeUserSockets(result.userId);
    logger.info("auth", "password reset completed", { userId: result.userId });
    return { ok: true };
  }

  if (result.status === "mismatch" || result.status === "locked") {
    throw new AppError(RESET_INVALID, 400, "RESET_TOKEN_INVALID");
  }

  if (result.status === "inactive") {
    throw new AppError("Account is not active", 403, "FORBIDDEN");
  }

  throw new AppError(RESET_INVALID, 400, "RESET_TOKEN_INVALID");
}
