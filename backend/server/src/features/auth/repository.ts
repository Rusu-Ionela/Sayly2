import { timingSafeEqual } from "crypto";
import { and, eq, isNull, lt, sql } from "drizzle-orm";

import { db } from "../../db/client";
import type { PasswordResetToken, RefreshToken, User, UserStatus } from "../../db/schema";
import { passwordResetTokens, refreshTokens, users } from "../../db/schema";
import { AppError } from "../../shared/errors/AppError";
import { requireRow } from "../../db/helpers";

/** Kept past expiry so a replayed old refresh token is still recognised as reuse. */
const TOKEN_RETENTION_MS = 24 * 60 * 60 * 1000;

/** Deletes refresh and password-reset rows that expired more than a day ago. */
export async function pruneExpiredTokens(now = new Date()) {
  const cutoff = new Date(now.getTime() - TOKEN_RETENTION_MS);
  await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, cutoff));
  await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, cutoff));
}

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  displayName: string;
};

export async function findUserByEmail(email: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createRefreshToken(data: {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
}): Promise<RefreshToken> {
  const [token] = await db
    .insert(refreshTokens)
    .values({
      userId: data.userId,
      tokenHash: data.tokenHash,
      familyId: data.familyId,
      expiresAt: data.expiresAt,
      userAgent: data.userAgent,
      ip: data.ip,
    })
    .returning();

  return requireRow(token, "refresh token");
}

export async function findRefreshTokenByHash(
  tokenHash: string,
): Promise<(RefreshToken & { user: User }) | null> {
  const row = await db.query.refreshTokens.findFirst({
    where: eq(refreshTokens.tokenHash, tokenHash),
    with: { user: true },
  });

  return row ?? null;
}

export async function revokeRefreshTokenFamily(familyId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
}

export async function createUserWithRefreshToken(
  userData: CreateUserInput,
  tokenData: {
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    userAgent?: string;
    ip?: string;
  },
): Promise<{ user: User; refreshToken: RefreshToken }> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: userData.email,
        passwordHash: userData.passwordHash,
        displayName: userData.displayName,
      })
      .returning();

    const createdUser = requireRow(user, "user");

    const [refreshToken] = await tx
      .insert(refreshTokens)
      .values({
        userId: createdUser.id,
        tokenHash: tokenData.tokenHash,
        familyId: tokenData.familyId,
        expiresAt: tokenData.expiresAt,
        userAgent: tokenData.userAgent,
        ip: tokenData.ip,
      })
      .returning();

    return { user: createdUser, refreshToken: requireRow(refreshToken, "refresh token") };
  });
}

const REFRESH_REUSE_GRACE_MS = 30_000;

/** A revoked child means logout or theft handling already ended the family, so no grace then. */
export function withinReuseGrace(parentRevokedAt: Date, childRevokedAt: Date | null, now = Date.now()) {
  return childRevokedAt === null && now - parentRevokedAt.getTime() < REFRESH_REUSE_GRACE_MS;
}

export type RotateRefreshResult =
  | { status: "invalid" }
  | { status: "revoked"; familyId: string; userId: string }
  | { status: "expired"; tokenId: string }
  | { status: "inactive"; userId: string }
  | { status: "rotated"; user: User; familyId: string };

export async function rotateRefreshTokenAtomic(params: {
  previousTokenHash: string;
  nextTokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
}): Promise<RotateRefreshResult> {
  return db.transaction(async (tx) => {
    const [parent] = await tx
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, params.previousTokenHash))
      .for("update")
      .limit(1);

    if (!parent) {
      return { status: "invalid" };
    }

    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, parent.userId))
      .for("update")
      .limit(1);

    if (!user) {
      return { status: "invalid" };
    }

    // A just-rotated token is accepted again for a short grace window: the phone may never have
    // received the first response. The abandoned child stays live until the family is revoked.
    let graceReuse = false;
    if (parent.revokedAt && parent.replacedById) {
      const [child] = await tx
        .select({ revokedAt: refreshTokens.revokedAt })
        .from(refreshTokens)
        .where(eq(refreshTokens.id, parent.replacedById))
        .limit(1);
      graceReuse = child !== undefined && withinReuseGrace(parent.revokedAt, child.revokedAt);
    }

    if (parent.revokedAt && !graceReuse) {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.familyId, parent.familyId), isNull(refreshTokens.revokedAt)));
      return { status: "revoked", familyId: parent.familyId, userId: parent.userId };
    }

    if (parent.expiresAt.getTime() <= Date.now()) {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, parent.id));
      return { status: "expired", tokenId: parent.id };
    }

    if (user.status !== "ACTIVE") {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, user.id), isNull(refreshTokens.revokedAt)));
      return { status: "inactive", userId: user.id };
    }

    const [created] = await tx
      .insert(refreshTokens)
      .values({
        userId: parent.userId,
        tokenHash: params.nextTokenHash,
        familyId: parent.familyId,
        expiresAt: params.expiresAt,
        userAgent: params.userAgent,
        ip: params.ip,
      })
      .returning();

    const child = requireRow(created, "refresh token");

    const rotated = graceReuse
      ? [parent]
      : await tx
          .update(refreshTokens)
          .set({
            revokedAt: new Date(),
            replacedById: child.id,
          })
          .where(and(eq(refreshTokens.id, parent.id), isNull(refreshTokens.revokedAt)))
          .returning({ id: refreshTokens.id });

    if (!rotated.length) {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.familyId, parent.familyId), isNull(refreshTokens.revokedAt)));
      return { status: "revoked", familyId: parent.familyId, userId: parent.userId };
    }

    return { status: "rotated", user, familyId: parent.familyId };
  });
}

export async function issuePasswordResetChallenge(data: {
  userId: string;
  challengeHash: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<PasswordResetToken> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.id, data.userId))
      .for("update")
      .limit(1);

    if (!user || user.status !== "ACTIVE") {
      throw new AppError("Account is not active", 403, "FORBIDDEN");
    }

    const [latest] = await tx
      .select({ createdAt: passwordResetTokens.createdAt })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, data.userId))
      .orderBy(sql`${passwordResetTokens.createdAt} desc`)
      .limit(1);

    if (latest && Date.now() - latest.createdAt.getTime() < 60_000) {
      throw new AppError("Please wait before requesting another reset code", 429, "RATE_LIMITED");
    }

    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, data.userId), isNull(passwordResetTokens.usedAt)));

    const [token] = await tx
      .insert(passwordResetTokens)
      .values({
        userId: data.userId,
        challengeHash: data.challengeHash,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        attempts: 0,
      })
      .returning();

    return requireRow(token, "password reset token");
  });
}

export type ConsumeResetResult =
  | { status: "invalid" }
  | { status: "locked" }
  | { status: "mismatch"; attempts: number }
  | { status: "inactive" }
  | { status: "ok"; userId: string };

export async function consumePasswordResetChallenge(params: {
  challengeHash: string;
  codeDigest: string;
  passwordHash: string;
}): Promise<ConsumeResetResult> {
  return db.transaction(async (tx) => {
    const [challenge] = await tx
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.challengeHash, params.challengeHash))
      .for("update")
      .limit(1);

    if (!challenge || challenge.usedAt || challenge.expiresAt.getTime() <= Date.now()) {
      return { status: "invalid" };
    }

    if (challenge.attempts >= 5) {
      return { status: "locked" };
    }

    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, challenge.userId))
      .for("update")
      .limit(1);

    if (!user || user.status !== "ACTIVE") {
      return { status: "inactive" };
    }

    const left = Buffer.from(challenge.tokenHash, "hex");
    const right = Buffer.from(params.codeDigest, "hex");
    const digestMatches =
      left.length > 0 && left.length === right.length && timingSafeEqual(left, right);

    if (!digestMatches) {
      const [updated] = await tx
        .update(passwordResetTokens)
        .set({ attempts: challenge.attempts + 1 })
        .where(eq(passwordResetTokens.id, challenge.id))
        .returning({ attempts: passwordResetTokens.attempts });
      return { status: "mismatch", attempts: updated?.attempts ?? challenge.attempts + 1 };
    }

    await tx
      .update(users)
      .set({
        passwordHash: params.passwordHash,
        authVersion: user.authVersion + 1,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, challenge.id));

    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          isNull(passwordResetTokens.usedAt),
        ),
      );

    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, user.id), isNull(refreshTokens.revokedAt)));

    return { status: "ok", userId: user.id };
  });
}

export type { User, UserStatus, RefreshToken, PasswordResetToken };
