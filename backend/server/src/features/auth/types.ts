import type { User, UserRole, UserStatus } from "../../db/schema";
import { resignMediaUrl } from "../media/storage";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  bio: string;
  photoUrl: string | null;
  emailVerifiedAt: string | null;
  status: UserStatus;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthSession = AuthTokens & {
  user: AuthUser;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
};

export type RequestMeta = {
  userAgent?: string;
  ip?: string;
};

export type ProfileIdentity = {
  displayName: string;
  bio: string | null;
  profileImageUrl: string | null;
};

/**
 * `Profile` wins for name, bio and avatar. The `User` copies are only read before
 * onboarding, when no Profile row exists yet.
 */
export function toAuthUser(user: User, profile?: ProfileIdentity | null): AuthUser {
  const photo = profile ? profile.profileImageUrl : user.photoUrl;
  return {
    id: user.id,
    email: user.email,
    displayName: profile?.displayName || user.displayName,
    bio: profile ? (profile.bio ?? "") : user.bio,
    photoUrl: resignMediaUrl(photo),
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    status: user.status,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
