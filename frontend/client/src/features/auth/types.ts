type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";
type UserRole = "USER" | "ADMIN";

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

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = {
  email: string;
  password: string;
  displayName: string;
};

export type MeResponse = {
  user: AuthUser;
};
