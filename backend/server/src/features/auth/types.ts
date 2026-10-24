import type { User, UserRole, UserStatus } from "../../db/schema";

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

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    bio: user.bio,
    photoUrl: user.photoUrl,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    status: user.status,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
