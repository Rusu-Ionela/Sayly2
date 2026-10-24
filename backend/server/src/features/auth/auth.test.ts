import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("./repository", () => ({
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  createRefreshToken: vi.fn(),
  findRefreshTokenByHash: vi.fn(),
  revokeRefreshTokenFamily: vi.fn(),
  createUserWithRefreshToken: vi.fn(),
  rotateRefreshTokenAtomic: vi.fn(),
  issuePasswordResetChallenge: vi.fn(),
  consumePasswordResetChallenge: vi.fn(),
}));

vi.mock("./mail", () => ({
  sendPasswordResetEmail: vi.fn(),
}));

import * as repository from "./repository";
import { hashPassword } from "./password";
import { hashRefreshToken, signAccessToken } from "./tokens";
import { createApp } from "../../lib/app";
import { buildOpenApiDocument } from "../../docs/openapi";

const mockedRepo = vi.mocked(repository);

/** Local fixtures — keep test types independent of the ORM. */
type TestUser = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  bio: string;
  photoUrl: string | null;
  emailVerifiedAt: Date | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DELETED";
  role: "USER" | "ADMIN";
  authProvider: "EMAIL";
  onboardingCompleted: boolean;
  saylyId: string;
  authVersion: number;
  isPro: boolean;
  lastSeenAt: Date | null;
  visitorsSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type TestRefreshToken = {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
};

type TestPasswordResetToken = {
  id: string;
  userId: string;
  tokenHash: string;
  challengeHash: string;
  attempts: number;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

function makePasswordResetToken(
  user: TestUser,
  overrides: Partial<TestPasswordResetToken> = {},
): TestPasswordResetToken & { user: TestUser } {
  const now = new Date();
  return {
    id: "prt-1",
    userId: user.id,
    tokenHash: "hash",
    challengeHash: "challenge-hash",
    attempts: 0,
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    createdAt: now,
    user,
    ...overrides,
  };
}

function makeUser(overrides: Partial<TestUser> = {}): TestUser {
  const now = new Date();
  return {
    id: "user-1",
    email: "learner@example.com",
    passwordHash: "hash",
    displayName: "Aryan",
    bio: "",
    photoUrl: null,
    emailVerifiedAt: null,
    status: "ACTIVE",
    role: "USER",
    authProvider: "EMAIL",
    onboardingCompleted: false,
    saylyId: "ABC12345",
    authVersion: 0,
    isPro: false,
    lastSeenAt: null,
    visitorsSeenAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeRefreshToken(
  user: TestUser,
  overrides: Partial<TestRefreshToken> = {},
): TestRefreshToken & { user: TestUser } {
  const now = new Date();
  return {
    id: "rt-1",
    userId: user.id,
    tokenHash: "hash",
    familyId: "family-1",
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    replacedById: null,
    userAgent: null,
    ip: null,
    createdAt: now,
    user,
    ...overrides,
  };
}

describe("auth schemas via HTTP", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid register payload", async () => {
    const res = await request(app).post("/auth/register").send({
      email: "not-an-email",
      password: "short",
      displayName: "",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields).toBeDefined();
  });

  it("rejects weak password", async () => {
    const res = await request(app).post("/auth/register").send({
      email: "ok@example.com",
      password: "password",
      displayName: "Aryan",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("registers successfully", async () => {
    const user = makeUser();
    mockedRepo.findUserByEmail.mockResolvedValue(null);
    mockedRepo.createUserWithRefreshToken.mockResolvedValue({
      user,
      refreshToken: makeRefreshToken(user),
    });

    const res = await request(app).post("/auth/register").send({
      email: "Learner@Example.com",
      password: "SecurePass1!",
      displayName: "Aryan",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("learner@example.com");
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("rejects duplicate email", async () => {
    mockedRepo.findUserByEmail.mockResolvedValue(makeUser());

    const res = await request(app).post("/auth/register").send({
      email: "learner@example.com",
      password: "SecurePass1!",
      displayName: "Aryan",
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("logs in successfully", async () => {
    const passwordHash = await hashPassword("SecurePass1");
    const user = makeUser({ passwordHash });
    mockedRepo.findUserByEmail.mockResolvedValue(user);
    mockedRepo.createRefreshToken.mockResolvedValue(makeRefreshToken(user));

    const res = await request(app).post("/auth/login").send({
      email: "learner@example.com",
      password: "SecurePass1",
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.id).toBe(user.id);
  });

  it("returns generic error for bad password", async () => {
    const passwordHash = await hashPassword("SecurePass1");
    mockedRepo.findUserByEmail.mockResolvedValue(makeUser({ passwordHash }));

    const res = await request(app).post("/auth/login").send({
      email: "learner@example.com",
      password: "WrongPass1",
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  it("returns generic error for missing user", async () => {
    mockedRepo.findUserByEmail.mockResolvedValue(null);

    const res = await request(app).post("/auth/login").send({
      email: "missing@example.com",
      password: "SecurePass1",
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects /auth/me without token", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects /auth/me with invalid token", async () => {
    const res = await request(app).get("/auth/me").set("Authorization", "Bearer not-a-jwt");
    expect(res.status).toBe(401);
    expect(["TOKEN_INVALID", "UNAUTHORIZED"]).toContain(res.body.error.code);
  });

  it("returns current user with valid token", async () => {
    const user = makeUser();
    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      authVersion: user.authVersion,
    });
    mockedRepo.findUserById.mockResolvedValue(user);

    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("logs out and revokes refresh token", async () => {
    const user = makeUser();
    const raw = "refresh-token-value";
    mockedRepo.findRefreshTokenByHash.mockResolvedValue(
      makeRefreshToken(user, { tokenHash: hashRefreshToken(raw) }),
    );
    mockedRepo.revokeRefreshTokenFamily.mockResolvedValue();

    const res = await request(app).post("/auth/logout").send({ refreshToken: raw });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockedRepo.revokeRefreshTokenFamily).toHaveBeenCalled();
  });

  it("rotates refresh tokens", async () => {
    const user = makeUser();
    const raw = "old-refresh-token";
    mockedRepo.findRefreshTokenByHash.mockResolvedValue(
      makeRefreshToken(user, { tokenHash: hashRefreshToken(raw) }),
    );
    mockedRepo.rotateRefreshTokenAtomic.mockResolvedValue({
      status: "rotated",
      user,
      familyId: "family-1",
    });

    const res = await request(app).post("/auth/refresh").send({ refreshToken: raw });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.refreshToken).not.toBe(raw);
    expect(mockedRepo.rotateRefreshTokenAtomic).toHaveBeenCalled();
  });

  it("detects refresh token reuse", async () => {
    const raw = "reused-token-value";
    mockedRepo.rotateRefreshTokenAtomic.mockResolvedValue({
      status: "revoked",
      familyId: "family-1",
      userId: "user-1",
    });

    const res = await request(app).post("/auth/refresh").send({ refreshToken: raw });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_REVOKED");
  });

  it("rejects expired refresh token", async () => {
    const raw = "expired-token-value";
    mockedRepo.rotateRefreshTokenAtomic.mockResolvedValue({
      status: "expired",
      tokenId: "rt-1",
    });

    const res = await request(app).post("/auth/refresh").send({ refreshToken: raw });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("accepts forgot-password and always returns ok", async () => {
    const user = makeUser();
    mockedRepo.findUserByEmail.mockResolvedValue(user);
    mockedRepo.issuePasswordResetChallenge.mockResolvedValue(makePasswordResetToken(user));

    const res = await request(app).post("/auth/forgot-password").send({
      email: "learner@example.com",
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.devCode).toBeUndefined();
    expect(typeof res.body.challengeId).toBe("string");
    expect(res.body.expiresInSeconds).toBe(300);
    expect(mockedRepo.issuePasswordResetChallenge).toHaveBeenCalled();
  });

  it("returns ok for forgot-password when user does not exist", async () => {
    mockedRepo.findUserByEmail.mockResolvedValue(null);

    const res = await request(app).post("/auth/forgot-password").send({
      email: "missing@example.com",
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.devCode).toBeUndefined();
    expect(typeof res.body.challengeId).toBe("string");
    expect(mockedRepo.issuePasswordResetChallenge).not.toHaveBeenCalled();
  });

  it("resets password with a valid challenge and token", async () => {
    const user = makeUser();
    mockedRepo.consumePasswordResetChallenge.mockResolvedValue({ status: "ok", userId: user.id });

    const res = await request(app).post("/auth/reset-password").send({
      challengeId: "challenge-id-value-min16",
      token: "48291355",
      password: "NewSecure1!",
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockedRepo.consumePasswordResetChallenge).toHaveBeenCalled();
  });

  it("rejects invalid reset token", async () => {
    mockedRepo.consumePasswordResetChallenge.mockResolvedValue({ status: "invalid" });

    const res = await request(app).post("/auth/reset-password").send({
      challengeId: "challenge-id-value-min16",
      token: "00000000",
      password: "NewSecure1!",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("RESET_TOKEN_INVALID");
  });
});

describe("OpenAPI", () => {
  it("builds a document with auth paths and bearerAuth", () => {
    const doc = buildOpenApiDocument();

    expect(doc.openapi).toBe("3.1.0");
    expect(doc.paths?.["/auth/register"]).toBeDefined();
    expect(doc.paths?.["/auth/login"]).toBeDefined();
    expect(doc.paths?.["/auth/logout"]).toBeDefined();
    expect(doc.paths?.["/auth/refresh"]).toBeDefined();
    expect(doc.paths?.["/auth/me"]).toBeDefined();
    expect(doc.components?.securitySchemes?.bearerAuth).toBeDefined();
    expect(doc.paths?.["/auth/me"]?.get?.security).toEqual([{ bearerAuth: [] }]);
  });

  it("serves swagger UI and openapi json when enabled", async () => {
    const app = createApp();

    const spec = await request(app).get("/api-docs/openapi.json");
    expect(spec.status).toBe(200);
    expect(spec.body.paths["/auth/login"]).toBeDefined();

    const ui = await request(app).get("/api-docs/");
    expect(ui.status).toBe(200);
  });
});

describe("password helpers", () => {
  it("hashes and verifies passwords", async () => {
    const hashed = await hashPassword("SecurePass1");
    expect(hashed).not.toContain("SecurePass1");
    expect(hashed.startsWith("$argon2")).toBe(true);
  });
});
