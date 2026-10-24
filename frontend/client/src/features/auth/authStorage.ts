import { Platform } from "react-native";

import { storage } from "@/lib/storage";

import type { AuthUser } from "./types";

const ACCESS_TOKEN_KEY = "auth.accessToken";
const REFRESH_TOKEN_KEY = "auth.refreshToken";
const USER_KEY = "auth.user";

export type StoredAuthTokens = {
  accessToken: string;
  refreshToken: string;
};

/**
 * AuthUser cache ≠ CurrentUserProfile cache.
 * Persisted auth user is a minimal bootstrap identity (no full profile fields).
 * Profile data stays in TanStack Query / profile API.
 */
function toPersistedUser(user: AuthUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    bio: "",
    photoUrl: null,
    emailVerifiedAt: user.emailVerifiedAt,
    status: user.status,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const authStorage = {
  async getTokens(): Promise<StoredAuthTokens | null> {
    const [accessToken, refreshToken] = await Promise.all([
      storage.get(ACCESS_TOKEN_KEY),
      storage.get(REFRESH_TOKEN_KEY),
    ]);

    // Web: tokens are memory + HttpOnly cookie. Clear any legacy localStorage secrets.
    if (Platform.OS === "web") {
      if (accessToken || refreshToken) {
        await Promise.all([storage.delete(ACCESS_TOKEN_KEY), storage.delete(REFRESH_TOKEN_KEY)]);
      }
      return null;
    }

    if (!accessToken || !refreshToken) {
      return null;
    }

    return { accessToken, refreshToken };
  },

  async setTokens(tokens: StoredAuthTokens): Promise<void> {
    if (Platform.OS === "web") {
      // Access stays in memory; refresh is HttpOnly cookie from the API.
      await Promise.all([storage.delete(ACCESS_TOKEN_KEY), storage.delete(REFRESH_TOKEN_KEY)]);
      return;
    }

    await Promise.all([
      storage.set(ACCESS_TOKEN_KEY, tokens.accessToken),
      storage.set(REFRESH_TOKEN_KEY, tokens.refreshToken),
    ]);
  },

  async getUser(): Promise<AuthUser | null> {
    const json = await storage.get(USER_KEY);
    if (!json) {
      return null;
    }

    try {
      const parsed = JSON.parse(json) as AuthUser;
      if (!parsed?.id || !parsed.email) {
        return null;
      }
      return toPersistedUser(parsed);
    } catch {
      return null;
    }
  },

  async setUser(user: AuthUser): Promise<void> {
    await storage.set(USER_KEY, JSON.stringify(toPersistedUser(user)));
  },

  async clear(): Promise<void> {
    await Promise.all([
      storage.delete(ACCESS_TOKEN_KEY),
      storage.delete(REFRESH_TOKEN_KEY),
      storage.delete(USER_KEY),
    ]);
  },
};
