import React, { useEffect } from "react";
import renderer, { act } from "react-test-renderer";

import type { AuthUser } from "./types";

const mockQueryClear = jest.fn();
const mockResetSocket = jest.fn();
const mockConfigureApiAuth = jest.fn();
const mockEnsureAccessToken = jest.fn(async () => true);
const mockGetMe = jest.fn();
const mockLogoutApi = jest.fn();
const mockMemory = new Map<string, string>();
let mockStorageThrowOnSet = false;

jest.mock("@/lib/queryClient", () => ({
  queryClient: {
    clear: (...args: unknown[]) => mockQueryClear(...args),
    cancelQueries: jest.fn(async () => undefined),
  },
}));

jest.mock("@/lib/socket", () => ({
  resetSocket: (...args: unknown[]) => mockResetSocket(...args),
  configureSocketAuth: jest.fn(),
}));

jest.mock("@/lib/apiClient", () => ({
  configureApiAuth: (...args: unknown[]) => mockConfigureApiAuth(...args),
  ensureAccessToken: (...args: unknown[]) => mockEnsureAccessToken(...args),
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

jest.mock("@/lib/logger", () => ({
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
  maskEmail: (email: string) => email,
}));

jest.mock("@/lib/storage", () => ({
  storage: {
    get: jest.fn(async (key: string) => mockMemory.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      if (mockStorageThrowOnSet) {
        throw new Error("SecureStore write failed");
      }
      mockMemory.set(key, value);
    }),
    delete: jest.fn(async (key: string) => {
      mockMemory.delete(key);
    }),
  },
}));

jest.mock("./api/authApi", () => ({
  getMe: (...args: unknown[]) => mockGetMe(...args),
  logout: (...args: unknown[]) => mockLogoutApi(...args),
  login: jest.fn(),
  register: jest.fn(),
}));

import { ApiError } from "@/lib/api/errors";

import { AuthProvider, useAuth } from "./AuthProvider";
import { authStorage } from "./authStorage";

const sampleUser: AuthUser = {
  id: "user-1",
  email: "a@example.com",
  displayName: "Ada",
  bio: "",
  photoUrl: null,
  emailVerifiedAt: null,
  status: "ACTIVE",
  role: "USER",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

type Snapshot = {
  isInitialized: boolean;
  isSignedIn: boolean;
  userId: string | null;
  signOut: () => Promise<void>;
};

function Probe({ onChange }: { onChange: (value: Snapshot) => void }) {
  const auth = useAuth();
  useEffect(() => {
    onChange({
      isInitialized: auth.isInitialized,
      isSignedIn: auth.isSignedIn,
      userId: auth.userId,
      signOut: auth.signOut,
    });
  }, [auth.isInitialized, auth.isSignedIn, auth.userId, auth.signOut, onChange]);
  return null;
}

async function mountAuth(): Promise<{ get: () => Snapshot }> {
  let latest: Snapshot | null = null;
  await act(async () => {
    renderer.create(
      React.createElement(
        AuthProvider,
        null,
        React.createElement(Probe, {
          onChange: (value: Snapshot) => {
            latest = value;
          },
        }),
      ),
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  if (!latest) {
    throw new Error("Auth probe did not mount");
  }
  return {
    get: () => {
      if (!latest) {
        throw new Error("Auth probe lost");
      }
      return latest;
    },
  };
}

describe("AuthProvider bootstrap/logout", () => {
  beforeEach(() => {
    mockMemory.clear();
    mockStorageThrowOnSet = false;
    mockQueryClear.mockReset();
    mockResetSocket.mockReset();
    mockConfigureApiAuth.mockReset();
    mockEnsureAccessToken.mockReset();
    mockEnsureAccessToken.mockResolvedValue(true);
    mockGetMe.mockReset();
    mockLogoutApi.mockReset();
  });

  it("bootstraps a stored session from cache without calling getMe when user is cached", async () => {
    await authStorage.setTokens({ accessToken: "access", refreshToken: "refresh" });
    await authStorage.setUser(sampleUser);

    const probe = await mountAuth();

    expect(mockGetMe).not.toHaveBeenCalled();
    expect(probe.get().isInitialized).toBe(true);
    expect(probe.get().isSignedIn).toBe(true);
    expect(probe.get().userId).toBe("user-1");
  });

  it("clears the session when refresh fails during bootstrap without access token", async () => {
    mockMemory.set("auth.refreshToken", "refresh");
    mockMemory.set("auth.user", JSON.stringify(sampleUser));
    mockEnsureAccessToken.mockResolvedValue(false);

    const probe = await mountAuth();

    expect(probe.get().isInitialized).toBe(true);
    expect(probe.get().isSignedIn).toBe(false);
    await expect(authStorage.getTokens()).resolves.toBeNull();
  });

  it("keeps a recovered user when bootstrap getMe hits a network error", async () => {
    await authStorage.setTokens({ accessToken: "access", refreshToken: "refresh" });
    mockGetMe.mockImplementation(async () => {
      await authStorage.setUser(sampleUser);
      throw new ApiError({
        status: 0,
        code: "NETWORK_ERROR",
        message: "offline",
      });
    });

    const probe = await mountAuth();

    expect(probe.get().isInitialized).toBe(true);
    expect(probe.get().isSignedIn).toBe(true);
    expect(probe.get().userId).toBe("user-1");
  });

  it("clears socket and query cache on logout", async () => {
    await authStorage.setTokens({ accessToken: "access", refreshToken: "refresh" });
    await authStorage.setUser(sampleUser);
    mockLogoutApi.mockResolvedValue(undefined);

    const probe = await mountAuth();

    await act(async () => {
      await probe.get().signOut();
    });

    expect(mockResetSocket).toHaveBeenCalled();
    expect(mockQueryClear).toHaveBeenCalled();
    await expect(authStorage.getTokens()).resolves.toBeNull();
    expect(probe.get().isSignedIn).toBe(false);
  });
});

describe("authStorage SecureStore failures", () => {
  beforeEach(() => {
    mockMemory.clear();
    mockStorageThrowOnSet = false;
  });

  it("surfaces SecureStore write failures instead of pretending tokens persisted", async () => {
    mockStorageThrowOnSet = true;
    await expect(
      authStorage.setTokens({ accessToken: "access", refreshToken: "refresh" }),
    ).rejects.toThrow(/SecureStore write failed/);
    await expect(authStorage.getTokens()).resolves.toBeNull();
  });
});
