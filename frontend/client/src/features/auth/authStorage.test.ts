import type { AuthUser } from "./types";
import { authStorage } from "./authStorage";

const mockMemory = new Map<string, string>();

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

jest.mock("@/lib/storage", () => ({
  storage: {
    get: jest.fn(async (key: string) => mockMemory.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      mockMemory.set(key, value);
    }),
    delete: jest.fn(async (key: string) => {
      mockMemory.delete(key);
    }),
  },
}));

const sampleUser: AuthUser = {
  id: "user-1",
  email: "a@example.com",
  displayName: "Ada",
  bio: "should be stripped",
  photoUrl: "https://example.com/a.png",
  emailVerifiedAt: null,
  status: "ACTIVE",
  role: "USER",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("authStorage bootstrap/logout persistence", () => {
  beforeEach(() => {
    mockMemory.clear();
  });

  it("persists tokens and a minimal user for bootstrap restore", async () => {
    await authStorage.setTokens({ accessToken: "access", refreshToken: "refresh" });
    await authStorage.setUser(sampleUser);

    await expect(authStorage.getTokens()).resolves.toEqual({
      accessToken: "access",
      refreshToken: "refresh",
    });
    await expect(authStorage.getUser()).resolves.toEqual({
      ...sampleUser,
      bio: "",
      photoUrl: null,
    });
  });

  it("clears tokens and user on logout", async () => {
    await authStorage.setTokens({ accessToken: "access", refreshToken: "refresh" });
    await authStorage.setUser(sampleUser);
    await authStorage.clear();

    await expect(authStorage.getTokens()).resolves.toBeNull();
    await expect(authStorage.getUser()).resolves.toBeNull();
  });
});
