import { and, asc, count, eq, isNull, or, sql } from "drizzle-orm";

import { db, type DbTransaction } from "../../db/client";
import {
  conversationTopics,
  follows,
  groupMembers,
  languageCertificates,
  onboardingDrafts,
  passwordResetTokens,
  profileViews,
  profiles,
  pushTokens,
  refreshTokens,
  savedPhrases,
  userLanguages,
  userSettings,
  users,
} from "../../db/schema";
import { revokeUserSockets } from "../../lib/sessionRevocation";
import { removeUserFromAllGroups } from "../groups/repository";
import { AppError } from "../../shared/errors/AppError";
import { hashPassword, verifyPassword } from "../auth/password";
import type { SyncUserLanguagesInput } from "../languages/types";
import * as languagesRepository from "../languages/repository";
import { findCityInCountry } from "../locations";
import { assertHumanFacePhoto } from "../media/faceDetection";
import {
  assertOwnedImageAsset,
  purgeUnusedMedia,
  readStoredFile,
  storeInlineImage,
} from "../media/service";
import { toStoredMediaPath } from "../media/storage";
import { countFollowers, countFollowing, isFollowing } from "../follows";
import { findDirectConversationId } from "../messaging/repository";
import { getPresence } from "../messaging/presence";
import { countNewVisitors, recordProfileView } from "../profileViews";
import { summarizeReferences } from "../references";

import { toLearningPreferenceColumns } from "./learningPreferences";
import { isBlockedEitherWay } from "../safety/repository";

import { ageFromDateOfBirth } from "./age";
import { MAX_AVATAR_BYTES, type AvatarInput } from "./avatar";
import { assertVisibleMember } from "./memberSummary";
import { SETTINGS_COLUMNS } from "./settings";
import {
  computeProfileCompleted,
  toPublicProfileDto,
  toSafePublicProfileDto,
  type CurrentUserSource,
  type PublicProfileSource,
} from "./dto";
import type {
  CertificateInput,
  CompleteOnboardingInput,
  OnboardingDraftInput,
  ProfileStatsDto,
  PublicUserProfile,
  SafePublicProfile,
  UpdateProfileInput,
} from "./types";
import { lockUser } from "../../db/helpers";

/** Profile + language columns every profile DTO is built from (never auth/moderation fields). */
const PROFILE_COLUMNS = {
  displayName: true,
  bio: true,
  country: true,
  city: true,
  profileImageUrl: true,
  practiceGoals: true,
  topics: true,
  photos: true,
  latitude: true,
  longitude: true,
  firstName: true,
  lastName: true,
  gender: true,
  profileAnswers: true,
  communicationMethods: true,
  timeCommitment: true,
  learningSchedule: true,
  correctionPreference: true,
  dateOfBirth: true,
  age: true,
  profileCompleted: true,
  discoverable: true,
} as const;

const LANGUAGES_WITH_CATALOG = {
  columns: {
    languageId: true,
    type: true,
    proficiencyLevel: true,
  },
  with: {
    language: {
      columns: {
        code: true,
        name: true,
        flagEmoji: true,
      },
    },
  },
} as const;

/** Relations every profile payload (self or public) is built from. */
const PROFILE_RELATIONS = {
  profile: { columns: PROFILE_COLUMNS },
  languages: LANGUAGES_WITH_CATALOG,
  certificates: {
    columns: {
      id: true,
      languageId: true,
      level: true,
      title: true,
      issuedYear: true,
    },
    with: { language: { columns: { name: true, flagEmoji: true } } },
    orderBy: asc(languageCertificates.createdAt),
  },
  settings: { columns: SETTINGS_COLUMNS },
  conversationTopics: {
    columns: { title: true },
    where: eq(conversationTopics.isMain, true),
    limit: 1,
  },
} as const;

async function loadProfileStats(userId: string): Promise<ProfileStatsDto> {
  const [[phrases], [groups], following, newVisitors] = await Promise.all([
    db.select({ n: count() }).from(savedPhrases).where(eq(savedPhrases.userId, userId)),
    db
      .select({ n: count() })
      .from(groupMembers)
      .where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "ACTIVE"))),
    countFollowing(userId),
    countNewVisitors(userId),
  ]);

  return {
    savedPhrases: phrases?.n ?? 0,
    groups: groups?.n ?? 0,
    following,
    newVisitors,
  };
}

/** Stores (or clears) the geocoded position. Called after a save, never inside its transaction. */
export async function setProfileCoordinates(
  userId: string,
  coordinates: { latitude: number; longitude: number } | null,
) {
  await db
    .update(profiles)
    .set({ latitude: coordinates?.latitude ?? null, longitude: coordinates?.longitude ?? null })
    .where(eq(profiles.userId, userId));
}

/**
 * Self profile source for `toCurrentUserDto` — the only extra column over the public
 * source is `email`; password hash and auth fields are never loaded.
 */
export async function getCurrentUserSource(userId: string): Promise<CurrentUserSource> {
  const [user, stats, referenceSummary] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        email: true,
        saylyId: true,
        isPro: true,
        onboardingCompleted: true,
      },
      with: PROFILE_RELATIONS,
    }),
    loadProfileStats(userId),
    summarizeReferences(userId),
  ]);

  if (!user) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  return { ...user, stats, referenceSummary };
}

/**
 * PRO-003: load only non-sensitive columns for public profile endpoints.
 * Never selects email, passwordHash, authProvider, role, etc.
 */
async function getPublicProfileSource(
  userId: string,
  viewerId: string,
): Promise<PublicProfileSource & { status: string }> {
  const [user, referenceSummary] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        status: true,
        isPro: true,
        onboardingCompleted: true,
      },
      with: PROFILE_RELATIONS,
    }),
    summarizeReferences(userId, viewerId),
  ]);

  if (!user) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  return { ...user, referenceSummary };
}

/** Row-locks an active user for the rest of the transaction. */
async function lockActiveUser(tx: DbTransaction, userId: string) {
  const [locked] = await tx
    .select({
      id: users.id,
      status: users.status,
      onboardingCompleted: users.onboardingCompleted,
      displayName: users.displayName,
      bio: users.bio,
      photoUrl: users.photoUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .for("update")
    .limit(1);

  if (!locked || locked.status !== "ACTIVE") {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  return locked;
}

async function countLanguagesByType(tx: DbTransaction, userId: string) {
  const rows = await tx
    .select({ type: userLanguages.type, count: sql<number>`count(*)::int` })
    .from(userLanguages)
    .where(eq(userLanguages.userId, userId))
    .groupBy(userLanguages.type);

  return {
    spokenCount: rows.find((row) => row.type === "SPEAKS")?.count ?? 0,
    learningCount: rows.find((row) => row.type === "LEARNING")?.count ?? 0,
  };
}

type ResolvedAvatar = {
  /** undefined = unchanged, null = cleared, string = stable stored path. */
  path: string | null | undefined;
  /** Removes a freshly written inline file if the surrounding transaction fails. */
  discard?: () => Promise<void>;
};

/**
 * PRO-002 avatar rules: inline base64 is stored as a new owned asset; a `/media/files`
 * reference must be the user's own image ≤ 2 MB unless it is the avatar they already have.
 * Every new avatar must show a real human face (see media/faceDetection).
 */
async function resolveAvatar(
  tx: DbTransaction,
  userId: string,
  avatar: AvatarInput | null | undefined,
  currentPath: string | null,
): Promise<ResolvedAvatar> {
  if (avatar === undefined || avatar === null) {
    return { path: avatar };
  }

  if (avatar.kind === "inline") {
    await assertHumanFacePhoto(avatar.data);
    const stored = await storeInlineImage(userId, avatar, "AVATAR", tx);
    return { path: stored.path, discard: stored.discard };
  }

  const path = toStoredMediaPath(avatar.url);
  if (path === currentPath) {
    return { path: undefined };
  }
  // Only our own uploads can be face-checked, so external URLs are refused by the schema.
  const storageKey = await assertOwnedImageAsset(
    userId,
    path,
    MAX_AVATAR_BYTES,
    tx,
  );
  await assertHumanFacePhoto(await readStoredFile(storageKey));
  return { path };
}

/**
 * Gallery rule (same as an avatar reference): every new photo must be the user's own
 * image of at most 2 MB. Photos already in the gallery are only reordered or removed.
 */
async function assertGalleryPhotos(
  tx: DbTransaction,
  userId: string,
  photos: string[],
  current: string[],
) {
  const existing = new Set(current);
  for (const path of photos) {
    if (!existing.has(path)) {
      await assertOwnedImageAsset(userId, path, MAX_AVATAR_BYTES, tx);
    }
  }
}

/**
 * A city must belong to the profile's country (the new one if it changes). Returns the
 * canonical spelling, null to clear, or undefined to keep — a country change drops a
 * city that is not in the new country.
 */
function resolveCity(
  input: Pick<UpdateProfileInput, "city" | "country">,
  current: { country: string; city: string | null },
): string | null | undefined {
  const country = input.country ?? current.country;
  if (input.city === null) {
    return null;
  }
  if (input.city !== undefined) {
    const canonical = findCityInCountry(country, input.city);
    if (!canonical) {
      throw new AppError(
        "Choose a city from the list for your country",
        400,
        "VALIDATION_ERROR",
      );
    }
    return canonical;
  }
  if (
    input.country !== undefined &&
    current.city &&
    !findCityInCountry(country, current.city)
  ) {
    return null;
  }
  return undefined;
}

/** Replaces the user's certificates; every language must exist in the catalog. */
async function replaceCertificates(
  tx: DbTransaction,
  userId: string,
  certificates: CertificateInput[],
) {
  const languageIds = [...new Set(certificates.map((item) => item.languageId))];
  const known = await languagesRepository.findLanguagesByIds(languageIds);
  if (known.length !== languageIds.length) {
    throw new AppError(
      "Certificate language not found",
      400,
      "VALIDATION_ERROR",
    );
  }

  await tx
    .delete(languageCertificates)
    .where(eq(languageCertificates.userId, userId));
  if (certificates.length > 0) {
    await tx.insert(languageCertificates).values(
      certificates.map((item) => ({
        userId,
        languageId: item.languageId,
        level: item.level,
        title: item.title,
        issuedYear: item.issuedYear ?? null,
      })),
    );
  }
}

/**
 * Profile fields duplicated on `User` (legacy auth payloads read them) — always written
 * in the same transaction as `Profile` so the two can never drift apart.
 */
function userMirrorOf(fields: {
  displayName?: string;
  bio?: string | null;
  photoUrl?: string | null;
}) {
  return {
    ...(fields.displayName !== undefined
      ? { displayName: fields.displayName }
      : {}),
    ...(fields.bio !== undefined ? { bio: fields.bio ?? "" } : {}),
    ...(fields.photoUrl !== undefined ? { photoUrl: fields.photoUrl } : {}),
  };
}

export async function completeOnboarding(
  userId: string,
  input: CompleteOnboardingInput,
) {
  await db.transaction(async (tx) => {
    const existingUser = await lockActiveUser(tx, userId);

    const [existingProfile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    const firstName = input.firstName?.trim() || existingProfile?.firstName || "";
    const lastName = input.lastName?.trim() || existingProfile?.lastName || "";
    const composedName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const displayName = composedName || input.displayName?.trim() || existingUser.displayName;
    const gender = input.gender ?? existingProfile?.gender ?? null;
    const profileAnswers = input.profileAnswers ?? existingProfile?.profileAnswers ?? [];
    const bio = input.bio ?? existingProfile?.bio ?? existingUser.bio ?? "";
    const country = input.country ?? existingProfile?.country ?? "";
    const practiceGoals =
      input.practiceGoals ?? existingProfile?.practiceGoals ?? [];
    const dateOfBirth =
      input.dateOfBirth ?? existingProfile?.dateOfBirth ?? undefined;
    const resolvedAge = dateOfBirth
      ? ageFromDateOfBirth(dateOfBirth)
      : (input.age ?? existingProfile?.age ?? undefined);

    if (resolvedAge !== undefined && (resolvedAge < 18 || resolvedAge > 120)) {
      throw new AppError("You must be at least 18 years old", 400, "VALIDATION_ERROR");
    }

    // Same ownership rule as profile edits: a new avatar must be the user's own upload.
    const currentAvatar =
      existingProfile?.profileImageUrl ?? existingUser.photoUrl ?? null;
    const avatar =
      input.profileImageUrl === undefined
        ? { path: undefined }
        : await resolveAvatar(
            tx,
            userId,
            { kind: "url", url: input.profileImageUrl },
            currentAvatar,
          );
    const profileImageUrl = avatar.path ?? currentAvatar ?? undefined;

    const profileCompleted = computeProfileCompleted({
      displayName,
      country,
      age: resolvedAge ?? null,
      spokenCount: input.spokenLanguages.length,
      learningCount: input.learningLanguages.length,
    });

    const profileValues = {
      displayName,
      firstName: firstName || null,
      lastName: lastName || null,
      gender,
      bio,
      country,
      dateOfBirth,
      age: resolvedAge,
      profileImageUrl,
      practiceGoals,
      profileAnswers,
      profileCompleted,
    };

    if (existingProfile) {
      await tx
        .update(profiles)
        .set(profileValues)
        .where(eq(profiles.userId, userId));
    } else {
      await tx.insert(profiles).values({ userId, ...profileValues });
    }

    await languagesRepository.syncUserLanguages(userId, input, tx);

    await tx
      .update(users)
      .set({
        onboardingCompleted: true,
        ...userMirrorOf({ displayName, bio, photoUrl: profileImageUrl }),
      })
      .where(eq(users.id, userId));

    await tx.delete(onboardingDrafts).where(eq(onboardingDrafts.userId, userId));
  });
}

export async function getOnboardingDraft(userId: string): Promise<OnboardingDraftInput | null> {
  const [row] = await db
    .select({
      userId: users.id,
      status: users.status,
      onboardingCompleted: users.onboardingCompleted,
      step: onboardingDrafts.step,
      questionIndex: onboardingDrafts.questionIndex,
      draft: onboardingDrafts.draft,
    })
    .from(users)
    .leftJoin(onboardingDrafts, eq(onboardingDrafts.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row || row.status !== "ACTIVE") {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }
  if (row.onboardingCompleted || !row.step || row.questionIndex === null || !row.draft) {
    return null;
  }

  return {
    step: row.step as OnboardingDraftInput["step"],
    questionIndex: row.questionIndex,
    draft: row.draft as OnboardingDraftInput["draft"],
  };
}

export async function saveOnboardingDraft(
  userId: string,
  input: OnboardingDraftInput,
): Promise<OnboardingDraftInput> {
  await db.transaction(async (tx) => {
    const user = await lockActiveUser(tx, userId);
    if (user.onboardingCompleted) {
      throw new AppError("Onboarding is already complete", 409, "CONFLICT");
    }
    await tx
      .insert(onboardingDrafts)
      .values({ userId, ...input })
      .onConflictDoUpdate({
        target: onboardingDrafts.userId,
        set: { step: input.step, questionIndex: input.questionIndex, draft: input.draft },
      });
  });
  return input;
}

/** What the viewer already has with this user: a chat and a follow, plus the follower total. */
async function loadViewerContext(viewerId: string, targetUserId: string) {
  const [conversationId, following, followerCount] = await Promise.all([
    findDirectConversationId(viewerId, targetUserId),
    isFollowing(viewerId, targetUserId),
    countFollowers(targetUserId),
  ]);
  return { conversationId, isFollowing: following, followerCount };
}

/** The presence layer already masks users who hide their online status. */
async function loadOnlineStatus(userId: string) {
  return (await getPresence(userId)).onlineStatus;
}

/**
 * PRO-001 visibility gate shared by both public-profile shapes: not yourself, no block
 * in either direction, target active and onboarded. Every miss is a 404 (never 403)
 * so clients cannot probe block relationships.
 */
async function loadVisibleProfile(viewerId: string, targetUserId: string) {
  if (viewerId === targetUserId) {
    throw new AppError(
      "Use /users/me for your own profile",
      400,
      "BAD_REQUEST",
    );
  }

  const [blocked, user, viewerContext, onlineStatus] = await Promise.all([
    isBlockedEitherWay(viewerId, targetUserId),
    getPublicProfileSource(targetUserId, viewerId),
    loadViewerContext(viewerId, targetUserId),
    loadOnlineStatus(targetUserId),
  ]);

  if (
    blocked ||
    !user.onboardingCompleted ||
    user.status !== "ACTIVE" ||
    !user.profile
  ) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  return { user, viewerContext: { ...viewerContext, onlineStatus } };
}

/** Legacy public profile (GET /users/:id). */
export async function getPublicProfile(
  viewerId: string,
  targetUserId: string,
): Promise<PublicUserProfile> {
  const { user, viewerContext } = await loadVisibleProfile(viewerId, targetUserId);
  return toPublicProfileDto(user, viewerContext);
}

/** PRO-001 / PRO-003 safe public profile — discovery-safe fields only. */
export async function getSafePublicProfile(
  viewerId: string,
  targetUserId: string,
): Promise<SafePublicProfile> {
  const { user, viewerContext } = await loadVisibleProfile(viewerId, targetUserId);
  recordProfileView(viewerId, targetUserId);
  return toSafePublicProfileDto(user, viewerContext);
}

/**
 * GET /users/by-sayly-id/:saylyId — resolves a shared code to a member id. Works only
 * while the owner keeps "Show my Sayly ID" on; any miss is a 404. Your own code
 * resolves to you so the client can open your profile.
 */
export async function findUserIdBySaylyId(viewerId: string, saylyId: string) {
  const owner = await db.query.users.findFirst({
    where: eq(users.saylyId, saylyId),
    columns: { id: true },
    with: { settings: { columns: { showSaylyId: true } } },
  });
  if (!owner) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }
  if (owner.id === viewerId) {
    return { userId: owner.id };
  }
  if (owner.settings?.showSaylyId === false) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }
  await assertVisibleMember(viewerId, owner.id);
  return { userId: owner.id };
}

/**
 * PRO-002 — the one write path for profile edits (PUT /users/me/profile, PATCH /users/me,
 * and the /users/me/languages endpoints). Profile, User mirror, languages, avatar asset
 * and `profileCompleted` are committed in a single transaction.
 */
export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const cleanup: { discardAvatar?: () => Promise<void> } = {};

  try {
    await db.transaction(async (tx) => {
      await lockActiveUser(tx, userId);

      const [profile] = await tx
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);
      if (!profile) {
        throw new AppError(
          "Complete onboarding before editing your profile",
          400,
          "BAD_REQUEST",
        );
      }

      const city = resolveCity(input, profile);
      const avatar = await resolveAvatar(
        tx,
        userId,
        input.avatar,
        profile.profileImageUrl,
      );
      cleanup.discardAvatar = avatar.discard;

      if (input.photos) {
        await assertGalleryPhotos(tx, userId, input.photos, profile.photos);
      }
      if (input.certificates) {
        await replaceCertificates(tx, userId, input.certificates);
      }

      if (input.languages) {
        await languagesRepository.syncUserLanguages(
          userId,
          input.languages,
          tx,
        );
      }

      const { spokenCount, learningCount } = input.languages
        ? {
            spokenCount: input.languages.spokenLanguages.length,
            learningCount: input.languages.learningLanguages.length,
          }
        : await countLanguagesByType(tx, userId);

      const nextAge =
        input.dateOfBirth !== undefined
          ? ageFromDateOfBirth(input.dateOfBirth)
          : profile.age;

      const profileCompleted = computeProfileCompleted({
        displayName: input.displayName ?? profile.displayName,
        country: input.country ?? profile.country,
        age: nextAge,
        spokenCount,
        learningCount,
      });

      await tx
        .update(profiles)
        .set({
          ...(input.displayName !== undefined
            ? { displayName: input.displayName }
            : {}),
          ...(input.bio !== undefined ? { bio: input.bio } : {}),
          ...(input.country !== undefined ? { country: input.country } : {}),
          ...(city !== undefined ? { city } : {}),
          ...(input.dateOfBirth !== undefined
            ? { dateOfBirth: input.dateOfBirth, age: nextAge }
            : {}),
          ...(avatar.path !== undefined
            ? { profileImageUrl: avatar.path }
            : {}),
          ...(input.practiceGoals !== undefined
            ? { practiceGoals: input.practiceGoals }
            : {}),
          ...(input.topics !== undefined ? { topics: input.topics } : {}),
          ...(input.photos !== undefined ? { photos: input.photos } : {}),
          ...(input.learningPreferences
            ? toLearningPreferenceColumns(input.learningPreferences)
            : {}),
          profileCompleted,
        })
        .where(eq(profiles.userId, userId));

      const mirror = userMirrorOf({
        displayName: input.displayName,
        bio: input.bio,
        photoUrl: avatar.path,
      });
      if (Object.keys(mirror).length > 0) {
        await tx
          .update(users)
          .set({ ...mirror, updatedAt: new Date() })
          .where(eq(users.id, userId));
      }
    });
  } catch (error) {
    await cleanup.discardAvatar?.();
    throw error;
  }
}

/** Languages-only edit — same transaction and rules as any other profile edit. */
export function updateUserLanguages(
  userId: string,
  input: SyncUserLanguagesInput,
) {
  return updateProfile(userId, { languages: input });
}

export async function softDeleteAccount(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }
  if (user.status === "DELETED") {
    throw new AppError("Account already deleted", 400, "BAD_REQUEST");
  }

  await db.transaction(async (tx) => {
    await lockUser(tx, userId);

    await tx
      .update(users)
      .set({
        status: "DELETED",
        email: `deleted_${userId}@sayly.invalid`,
        passwordHash: "deleted",
        onboardingCompleted: false,
        authVersion: sql`${users.authVersion} + 1`,
        displayName: "Deleted user",
        bio: "",
        photoUrl: null,
      })
      .where(eq(users.id, userId));

    await tx
      .update(profiles)
      .set({
        profileCompleted: false,
        displayName: "Deleted user",
        bio: null,
        profileImageUrl: null,
        dateOfBirth: null,
        age: null,
        country: "",
        city: null,
        practiceGoals: [],
        topics: [],
        photos: [],
        latitude: null,
        longitude: null,
        discoverable: false,
      })
      .where(eq(profiles.userId, userId));

    await tx
      .delete(languageCertificates)
      .where(eq(languageCertificates.userId, userId));
    await tx.delete(userSettings).where(eq(userSettings.userId, userId));
    await tx.delete(pushTokens).where(eq(pushTokens.userId, userId));
    // Profile dashboard data: topics, who they follow / who follows them, profile visits.
    await tx.delete(conversationTopics).where(eq(conversationTopics.userId, userId));
    await tx
      .delete(follows)
      .where(or(eq(follows.followerId, userId), eq(follows.followeeId, userId)));
    await tx
      .delete(profileViews)
      .where(or(eq(profileViews.viewerId, userId), eq(profileViews.viewedId, userId)));

    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)),
      );

    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));

    await removeUserFromAllGroups(tx, userId);
  });

  revokeUserSockets(userId);
  // Chat media stays so the other person's history still loads; everything else goes.
  await purgeUnusedMedia(userId).catch(() => undefined);
  return { ok: true as const };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.status !== "ACTIVE") {
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  }
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new AppError(
      "Current password is incorrect",
      400,
      "VALIDATION_ERROR",
    );
  }

  const passwordHash = await hashPassword(newPassword);

  await db.transaction(async (tx) => {
    const changed = await tx
      .update(users)
      .set({
        passwordHash,
        authVersion: sql`${users.authVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(users.id, userId),
          eq(users.status, "ACTIVE"),
          eq(users.passwordHash, user.passwordHash),
        ),
      )
      .returning({ id: users.id });

    if (!changed.length) {
      throw new AppError("Account changed; retry", 409, "CONFLICT");
    }

    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)),
      );

    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          isNull(passwordResetTokens.usedAt),
        ),
      );
  });

  revokeUserSockets(userId);
  return { ok: true as const };
}
