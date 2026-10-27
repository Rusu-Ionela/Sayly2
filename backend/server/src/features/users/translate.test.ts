import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { AppError } from "../../shared/errors/AppError";

vi.mock("../../shared/middleware/authenticate", () => ({
  optionalAuthenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
  authenticate: (
    req: { get: (name: string) => string | undefined; userId?: string; user?: { id: string } },
    _res: unknown,
    next: (err?: unknown) => void,
  ) => {
    if (!req.get("authorization")) {
      next(new AppError("Authentication required", 401, "UNAUTHORIZED"));
      return;
    }
    req.userId = "viewer-1";
    req.user = { id: "viewer-1" };
    next();
  },
}));

vi.mock("./repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./repository")>()),
  getSafePublicProfile: vi.fn(),
}));
vi.mock("./settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./settings")>()),
  getTranslateToSetting: vi.fn(async () => null),
}));
vi.mock("../languages/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../languages/service")>()),
  getMyLanguages: vi.fn(),
}));

import { createApp } from "../../lib/app";
import * as languagesService from "../languages/service";
import * as usersRepository from "./repository";

const mockedProfile = vi.mocked(usersRepository.getSafePublicProfile);
const mockedLanguages = vi.mocked(languagesService.getMyLanguages);

const app = createApp();
const auth = { Authorization: "Bearer test" };

function profile(overrides: Record<string, unknown>) {
  return {
    id: "user-2",
    bio: "",
    topics: [] as string[],
    ...overrides,
  } as unknown as Awaited<ReturnType<typeof usersRepository.getSafePublicProfile>>;
}

function myMemoryReplies(text: string) {
  return vi.fn(async (_url: unknown) =>
    new Response(JSON.stringify({ responseStatus: 200, responseData: { translatedText: text } })),
  );
}

describe("POST /users/:id/translate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedLanguages.mockResolvedValue({
      SPEAKS: [{ code: "ro", proficiency: "NATIVE" }],
      LEARNING: [],
    } as unknown as Awaited<ReturnType<typeof languagesService.getMyLanguages>>);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/users/user-2/translate").send({ field: "bio" });
    expect(res.status).toBe(401);
  });

  it("only allows the bio and topics fields", async () => {
    const res = await request(app)
      .post("/users/user-2/translate")
      .set(auth)
      .send({ field: "email" });
    expect(res.status).toBe(400);
    expect(mockedProfile).not.toHaveBeenCalled();
  });

  it("translates the bio into the viewer's native language", async () => {
    mockedProfile.mockResolvedValueOnce(profile({ bio: "Привет, я учу английский" }));
    const fetchMock = myMemoryReplies("Salut, invat engleza");
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(app).post("/users/user-2/translate").set(auth).send({ field: "bio" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ text: "Salut, invat engleza", lang: "ro" });
    const requested = new URL(String(fetchMock.mock.calls[0]?.[0]));
    // The source is detected by Sayly (Russian text), never left to MyMemory's autodetect.
    expect(requested.searchParams.get("langpair")).toBe("ru|ro");
  });

  it("translates topics as one comma-separated line", async () => {
    mockedProfile.mockResolvedValueOnce(profile({ topics: ["Music", "Travel"] }));
    const fetchMock = myMemoryReplies("Muzica, calatorii");
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(app)
      .post("/users/user-2/translate")
      .set(auth)
      .send({ field: "topics" });

    expect(res.status).toBe(200);
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get("q")).toBe("Music, Travel");
  });

  it("400s when the field is empty, without calling the translator", async () => {
    mockedProfile.mockResolvedValueOnce(profile({ bio: "   " }));
    const fetchMock = myMemoryReplies("x");
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(app).post("/users/user-2/translate").set(auth).send({ field: "bio" });

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes through 404 for blocked or hidden users", async () => {
    mockedProfile.mockRejectedValueOnce(new AppError("User not found", 404, "NOT_FOUND"));
    const res = await request(app).post("/users/user-2/translate").set(auth).send({ field: "bio" });
    expect(res.status).toBe(404);
  });

  it("returns 502 when the translation service fails", async () => {
    mockedProfile.mockResolvedValueOnce(profile({ bio: "Hello" }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const res = await request(app).post("/users/user-2/translate").set(auth).send({ field: "bio" });
    expect(res.status).toBe(502);
  });
});
