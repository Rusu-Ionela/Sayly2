import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { MAX_LEARNING_LANGUAGES } from "@sayly/shared";

import { AppError } from "../../shared/errors/AppError";
import { syncUserLanguagesSchema } from "./schema";
import { LANGUAGE_CATALOG } from "./catalog";
import { groupUserLanguages } from "./dto";

vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"));

vi.mock("./service", () => ({
  listLanguages: vi.fn(),
  getMyLanguages: vi.fn(),
  assertLanguagesExist: vi.fn(),
}));

vi.mock("../users/service", () => ({
  getMe: vi.fn(),
  completeOnboarding: vi.fn(),
  updateMe: vi.fn(),
  putMeProfile: vi.fn(),
  getUserById: vi.fn(),
  getPublicProfile: vi.fn(),
  getMyLanguages: vi.fn(),
  putMyLanguages: vi.fn(),
  updateLanguages: vi.fn(),
  softDeleteAccount: vi.fn(),
  changePassword: vi.fn(),
}));

import { createApp } from "../../lib/app";
import * as languagesService from "./service";
import * as usersService from "../users/service";

const mockedLanguages = vi.mocked(languagesService);
const mockedUsers = vi.mocked(usersService);

const validPayload = {
  spokenLanguages: [{ languageId: "ro", proficiency: "NATIVE" }],
  learningLanguages: [{ languageId: "en", proficiency: "INTERMEDIATE" }],
};

describe("LANG-001P0 / LANG-002P0 languages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("catalog", () => {
    it("includes the full ISO-639-1 catalog, unique codes, popularity order", () => {
      expect(LANGUAGE_CATALOG.length).toBeGreaterThanOrEqual(180);
      const codes = LANGUAGE_CATALOG.map((item) => item.code);
      expect(new Set(codes).size).toBe(LANGUAGE_CATALOG.length);
      expect(LANGUAGE_CATALOG[0]?.code).toBe("en");
      expect(LANGUAGE_CATALOG[1]?.code).toBe("es");
      expect(LANGUAGE_CATALOG[2]?.code).toBe("fr");
      for (const [index, language] of LANGUAGE_CATALOG.entries()) {
        expect(language.code).toMatch(/^[a-z]{2}$/);
        expect(language.name.length).toBeGreaterThan(0);
        expect(language.flagEmoji.length).toBeGreaterThan(0);
        expect(language.sortOrder).toBe(index + 1);
      }
    });
  });

  describe("Zod validation", () => {
    it("accepts a valid spoken/learning payload", () => {
      expect(syncUserLanguagesSchema.parse(validPayload)).toEqual(validPayload);
    });

    it("rejects more than 5 learning languages", () => {
      expect(() =>
        syncUserLanguagesSchema.parse({
          spokenLanguages: [{ languageId: "ro", proficiency: "NATIVE" }],
          learningLanguages: [
            { languageId: "en", proficiency: "BEGINNER" },
            { languageId: "es", proficiency: "BEGINNER" },
            { languageId: "fr", proficiency: "BEGINNER" },
            { languageId: "de", proficiency: "BEGINNER" },
            { languageId: "it", proficiency: "BEGINNER" },
            { languageId: "ja", proficiency: "BEGINNER" },
          ],
        }),
      ).toThrow();
      expect(MAX_LEARNING_LANGUAGES).toBe(5);
    });

    it("rejects the same language as SPEAKS and LEARNING", () => {
      expect(() =>
        syncUserLanguagesSchema.parse({
          spokenLanguages: [{ languageId: "en", proficiency: "NATIVE" }],
          learningLanguages: [{ languageId: "en", proficiency: "BEGINNER" }],
        }),
      ).toThrow();
    });

    it("rejects the same language at the same proficiency for both types", () => {
      expect(() =>
        syncUserLanguagesSchema.parse({
          spokenLanguages: [{ languageId: "es", proficiency: "INTERMEDIATE" }],
          learningLanguages: [{ languageId: "es", proficiency: "INTERMEDIATE" }],
        }),
      ).toThrow();
    });

    it("rejects duplicate languageIds within spoken languages", () => {
      expect(() =>
        syncUserLanguagesSchema.parse({
          spokenLanguages: [
            { languageId: "ro", proficiency: "NATIVE" },
            { languageId: "ro", proficiency: "FLUENT" },
          ],
          learningLanguages: [{ languageId: "en", proficiency: "BEGINNER" }],
        }),
      ).toThrow();
    });
  });

  describe("grouping", () => {
    it("groups rows by SPEAKS and LEARNING", () => {
      const grouped = groupUserLanguages([
        {
          id: "ul-1",
          languageId: "ro",
          type: "SPEAKS",
          proficiencyLevel: "NATIVE",
          language: { code: "ro", name: "Romanian", flagEmoji: "🇷🇴" },
        },
        {
          id: "ul-2",
          languageId: "en",
          type: "LEARNING",
          proficiencyLevel: "INTERMEDIATE",
          language: { code: "en", name: "English", flagEmoji: "🇬🇧" },
        },
      ]);

      expect(grouped.SPEAKS).toHaveLength(1);
      expect(grouped.LEARNING).toHaveLength(1);
      expect(grouped.SPEAKS[0]?.flagEmoji).toBe("🇷🇴");
      expect(grouped.LEARNING[0]?.type).toBe("LEARNING");
    });
  });

  describe("HTTP", () => {
    const app = createApp();

    it("GET /languages returns the catalog with flagEmoji", async () => {
      mockedLanguages.listLanguages.mockResolvedValue([
        { id: "en", code: "en", name: "English", flagEmoji: "🇬🇧", sortOrder: 1 },
      ]);

      const res = await request(app).get("/languages");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        { id: "en", code: "en", name: "English", flagEmoji: "🇬🇧", sortOrder: 1 },
      ]);
      expect(mockedLanguages.listLanguages).toHaveBeenCalled();
    });

    it("GET /users/me/languages returns 401 without a token", async () => {
      const res = await request(app).get("/users/me/languages");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
      expect(mockedUsers.getMyLanguages).not.toHaveBeenCalled();
    });

    it("GET /users/me/languages returns grouped languages", async () => {
      mockedUsers.getMyLanguages.mockResolvedValue({
        SPEAKS: [
          {
            id: "ul-1",
            languageId: "ro",
            code: "ro",
            name: "Romanian",
            flagEmoji: "🇷🇴",
            type: "SPEAKS",
            proficiency: "NATIVE",
          },
        ],
        LEARNING: [
          {
            id: "ul-2",
            languageId: "en",
            code: "en",
            name: "English",
            flagEmoji: "🇬🇧",
            type: "LEARNING",
            proficiency: "INTERMEDIATE",
          },
        ],
      });

      const res = await request(app)
        .get("/users/me/languages")
        .set("Authorization", "Bearer test");

      expect(res.status).toBe(200);
      expect(res.body.SPEAKS[0].languageId).toBe("ro");
      expect(res.body.LEARNING[0].languageId).toBe("en");
      expect(mockedUsers.getMyLanguages).toHaveBeenCalledWith("viewer-1");
    });

    it("PUT /users/me/languages validates payload", async () => {
      const res = await request(app)
        .put("/users/me/languages")
        .set("Authorization", "Bearer test")
        .send({ spokenLanguages: [], learningLanguages: [] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(mockedUsers.putMyLanguages).not.toHaveBeenCalled();
    });

    it("PUT /users/me/languages syncs and returns grouped languages", async () => {
      mockedUsers.putMyLanguages.mockResolvedValue({
        SPEAKS: [
          {
            id: "ul-1",
            languageId: "ro",
            code: "ro",
            name: "Romanian",
            flagEmoji: "🇷🇴",
            type: "SPEAKS",
            proficiency: "NATIVE",
          },
        ],
        LEARNING: [
          {
            id: "ul-2",
            languageId: "en",
            code: "en",
            name: "English",
            flagEmoji: "🇬🇧",
            type: "LEARNING",
            proficiency: "INTERMEDIATE",
          },
        ],
      });

      const res = await request(app)
        .put("/users/me/languages")
        .set("Authorization", "Bearer test")
        .send(validPayload);

      expect(res.status).toBe(200);
      expect(res.body.SPEAKS).toHaveLength(1);
      expect(mockedUsers.putMyLanguages).toHaveBeenCalledWith("viewer-1", validPayload);
    });

    it("PUT /users/me/languages returns 404 when a language does not exist", async () => {
      mockedUsers.putMyLanguages.mockRejectedValue(
        new AppError("Language not found: xx", 404, "NOT_FOUND"),
      );

      const res = await request(app)
        .put("/users/me/languages")
        .set("Authorization", "Bearer test")
        .send(validPayload);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });
});
