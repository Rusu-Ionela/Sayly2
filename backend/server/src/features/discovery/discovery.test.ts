import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { AppError } from "../../shared/errors/AppError";
import { assertNoSensitivePublicFields } from "../users/dto";
import { countryMatchCandidates } from "../users/countries";

import { toDiscoverUserDto } from "./dto";
import { toDiscoverPage } from "./pagination";
import { discoverQuerySchema } from "./schema";
import { scoreAndDescribe, type LanguageRow } from "./scoring";

vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"));

vi.mock("./service", () => ({
  discover: vi.fn(),
  getDiscoverUser: vi.fn(),
}));

import { createApp } from "../../lib/app";
import * as discoveryService from "./service";

const mockedDiscover = vi.mocked(discoveryService.discover);
const mockedGetDiscoverUser = vi.mocked(discoveryService.getDiscoverUser);

const russianNative: LanguageRow = {
  languageId: "ru",
  type: "SPEAKS",
  proficiencyLevel: "NATIVE",
  language: { code: "ru", name: "Russian" },
};

const englishLearning: LanguageRow = {
  languageId: "en",
  type: "LEARNING",
  proficiencyLevel: "INTERMEDIATE",
  language: { code: "en", name: "English" },
};

const russianLearning: LanguageRow = {
  languageId: "ru",
  type: "LEARNING",
  proficiencyLevel: "BEGINNER",
  language: { code: "ru", name: "Russian" },
};

const japaneseSpoken: LanguageRow = {
  languageId: "ja",
  type: "SPEAKS",
  proficiencyLevel: "NATIVE",
  language: { code: "ja", name: "Japanese" },
};

function emptyDiscoverPage() {
  return toDiscoverPage([], 1, 20, 0);
}

describe("DISC-001 / DISC-002 / DISC-003 / DISC-004 / DISC-005 / DISC-006 discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("discoverQuerySchema", () => {
    it("defaults page and limit", () => {
      expect(discoverQuerySchema.parse({})).toEqual({
        search: undefined,
        spokenLanguageId: undefined,
        learningLanguageId: undefined,
        country: undefined,
        proficiency: undefined,
        page: 1,
        limit: 20,
      });
    });

    it("maps spokenLanguage / learningLanguage aliases onto *Id fields", () => {
      const parsed = discoverQuerySchema.parse({
        spokenLanguage: "ru",
        learningLanguage: "en",
      });
      expect(parsed.spokenLanguageId).toBe("ru");
      expect(parsed.learningLanguageId).toBe("en");
    });

    it("prefers spokenLanguageId over the legacy alias", () => {
      const parsed = discoverQuerySchema.parse({
        spokenLanguageId: "ja",
        spokenLanguage: "ru",
      });
      expect(parsed.spokenLanguageId).toBe("ja");
    });

    it("accepts DISC-003 proficiency values and normalizes case", () => {
      expect(discoverQuerySchema.parse({ proficiency: "beginner" }).proficiency).toBe("BEGINNER");
      expect(discoverQuerySchema.parse({ proficiency: "NATIVE" }).proficiency).toBe("NATIVE");
      expect(discoverQuerySchema.parse({ proficiency: "fluent" }).proficiency).toBe("FLUENT");
    });

    it("treats blank query strings as omitted", () => {
      const parsed = discoverQuerySchema.parse({
        search: "   ",
        country: "",
        spokenLanguageId: " ",
      });
      expect(parsed.search).toBeUndefined();
      expect(parsed.country).toBeUndefined();
      expect(parsed.spokenLanguageId).toBeUndefined();
    });

    it("rejects out-of-range pagination", () => {
      expect(() => discoverQuerySchema.parse({ page: 0 })).toThrow();
      expect(() => discoverQuerySchema.parse({ limit: 51 })).toThrow();
    });
  });

  describe("pagination meta (DISC-004)", () => {
    it("computes offset-compatible meta and keeps top-level aliases", () => {
      const result = toDiscoverPage([], 2, 20, 45);
      expect(result.meta).toEqual({
        page: 2,
        limit: 20,
        total: 45,
        totalPages: 3,
        hasMore: true,
      });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.total).toBe(45);
      expect(result.totalCount).toBe(45);
      expect(result.hasMore).toBe(true);
      expect((2 - 1) * 20).toBe(20);
    });

    it("marks the last page as complete", () => {
      const result = toDiscoverPage([], 3, 20, 45);
      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe("deterministic match scoring (DISC-005)", () => {
    it("scores a mutual language exchange at 100+", () => {
      const result = scoreAndDescribe(
        new Set(["en"]),
        new Set(["ru"]),
        [russianNative, englishLearning],
        "Maria",
      );
      expect(result.matchType).toBe("MUTUAL");
      expect(result.matchScore).toBe(102);
      expect(result.matchLabel).toBe(
        "Maria speaks Russian (Native) and wants to learn English",
      );
    });

    it("scores one-way overlap as PARTIAL in 50-99", () => {
      const result = scoreAndDescribe(new Set(["en"]), new Set(["ru"]), [russianNative], "Ivan");
      expect(result.matchType).toBe("PARTIAL");
      expect(result.matchScore).toBeGreaterThanOrEqual(50);
      expect(result.matchScore).toBeLessThan(100);
    });

    it("scores a shared learning language as PARTIAL", () => {
      const result = scoreAndDescribe(
        new Set(["en"]),
        new Set(["ru"]),
        [japaneseSpoken, russianLearning],
        "Kenji",
      );
      expect(result.matchType).toBe("PARTIAL");
      expect(result.matchScore).toBe(58);
    });

    it("scores no teach/learn overlap as NONE below 50", () => {
      const result = scoreAndDescribe(new Set(["en"]), new Set(["ja"]), [russianNative], "Ana");
      expect(result.matchType).toBe("NONE");
      expect(result.matchScore).toBe(0);
    });

    it("explains a mutual match with data-backed reasons", () => {
      const result = scoreAndDescribe(
        new Set(["en"]),
        new Set(["ru"]),
        [russianNative, englishLearning],
        "Maria",
        ["Grammar"],
      );
      expect(result.matchReasons).toEqual([
        "Speaks Russian (native), which you're learning",
        "Wants to learn English, which you speak",
        "Both want to practice grammar",
      ]);
    });

    it("lets shared goals reorder within a band but never promote it", () => {
      const goals = ["Conversation", "Grammar", "Culture", "Reading", "Writing", "Speaking", "Listening", "Vocabulary", "Pronunciation"];
      const mutual = scoreAndDescribe(new Set(["en"]), new Set(["ru"]), [russianNative, englishLearning], "M", goals);
      expect(mutual.matchScore).toBe(102 + goals.length);

      const partial = scoreAndDescribe(new Set(["en"]), new Set(["ru"]), [japaneseSpoken, russianLearning], "K", goals);
      expect(partial.matchType).toBe("PARTIAL");
      expect(partial.matchScore).toBeLessThan(100);

      const none = scoreAndDescribe(new Set(["en"]), new Set(["ja"]), [russianNative], "A", goals);
      expect(none.matchScore).toBe(0);
      expect(none.matchReasons).toEqual(["Both want to practice conversation & grammar"]);
    });

    it("keeps shared-speak-only matches in the NONE band", () => {
      const englishSpoken: LanguageRow = {
        languageId: "en",
        type: "SPEAKS",
        proficiencyLevel: "NATIVE",
        language: { code: "en", name: "English" },
      };
      const koreanLearning: LanguageRow = {
        languageId: "ko",
        type: "LEARNING",
        proficiencyLevel: "BEGINNER",
        language: { code: "ko", name: "Korean" },
      };
      const result = scoreAndDescribe(
        new Set(["en"]),
        new Set(["ja"]),
        [englishSpoken, koreanLearning],
        "Sam",
      );
      expect(result.matchType).toBe("NONE");
      expect(result.matchScore).toBeGreaterThan(0);
      expect(result.matchScore).toBeLessThan(50);
    });
  });

  describe("safe DTO", () => {
    it("omits sensitive keys", () => {

      const dto = toDiscoverUserDto({
        id: "user-2",
        displayName: "Maria",
        country: "Russia",
        profileImageUrl: "https://cdn.example/maria.png",
        age: 29,
        bio: `  Hi!   ${"x".repeat(400)}`,
        practiceGoals: ["Conversation"],
        sharedGoals: [],
        spokenLanguages: [
          { languageId: "ru", code: "ru", name: "Russian", proficiency: "NATIVE" },
        ],
        learningLanguages: [
          { languageId: "en", code: "en", name: "English", proficiency: "INTERMEDIATE" },
        ],
        matchScore: 102,
        matchType: "MUTUAL",
        matchLabel: "Maria speaks Russian (Native) and wants to learn English",
        matchReasons: [],
      });

      expect(dto.profileImageUrl).toBe("https://cdn.example/maria.png");
      expect(dto.photoUrl).toBe("https://cdn.example/maria.png");
      // Cards carry only a short, whitespace-normalized public bio snippet.
      expect(dto.bio.startsWith("Hi! x")).toBe(true);
      expect(dto.bio.length).toBeLessThanOrEqual(160);
      expect(dto.matchType).toBe("MUTUAL");
      assertNoSensitivePublicFields(dto as unknown as Record<string, unknown>);
    });
  });

  describe("country filter aliases (DISC-003)", () => {
    it("matches ISO codes and English names interchangeably", () => {
      const fromIso = countryMatchCandidates("ro");
      const fromName = countryMatchCandidates("Romania");
      expect(fromIso).toEqual(expect.arrayContaining(["ro", "romania"]));
      expect(fromName).toEqual(expect.arrayContaining(["ro", "romania"]));
    });
  });

  describe("HTTP", () => {
    const app = createApp();

    it("requires authentication", async () => {
      const res = await request(app).get("/discover");
      expect(res.status).toBe(401);
    });

    it("returns paginated discovery cards on GET /discover", async () => {
      mockedDiscover.mockResolvedValue(emptyDiscoverPage());

      const res = await request(app)
        .get("/discover")
        .set("Authorization", "Bearer test")
        .query({ search: "Maria", spokenLanguageId: "ru", proficiency: "NATIVE" });

      expect(res.status).toBe(200);
      expect(mockedDiscover).toHaveBeenCalledWith("viewer-1", {
        search: "Maria",
        spokenLanguageId: "ru",
        learningLanguageId: undefined,
        country: undefined,
        proficiency: "NATIVE",
        page: 1,
        limit: 20,
      });
      expect(res.body).toEqual(emptyDiscoverPage());
      expect(res.body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasMore: false,
      });
    });

    it("rejects invalid query params with 400", async () => {
      const res = await request(app)
        .get("/discover")
        .set("Authorization", "Bearer test")
        .query({ limit: 99 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(mockedDiscover).not.toHaveBeenCalled();
    });

    it("GET /discover/users/:id returns the public profile (DISC-006)", async () => {
      const profile = {
        id: "target-1",
        displayName: "Maria",
        avatarUrl: "https://cdn.example/maria.png",
        profileImageUrl: "https://cdn.example/maria.png",
        country: "RU",
        bio: "Let's practice together.",
        spokenLanguages: [
          {
            languageId: "ru",
            code: "ru",
            name: "Russian",
            flagEmoji: "🇷🇺",
            proficiency: "NATIVE" as const,
          },
        ],
        learningLanguages: [
          {
            languageId: "en",
            code: "en",
            name: "English",
            flagEmoji: "🇬🇧",
            proficiency: "INTERMEDIATE" as const,
          },
        ],
        practiceGoals: ["Conversation"],
        onlineStatus: "UNKNOWN" as const,
        isPro: false,
        city: null,
        topics: [],
        photos: [],
        certificates: [],
        mainTopic: null,
        references: { total: 0, positive: 0 },
        learningPreferences: { communication: [], timeCommitment: null, schedule: [], correction: null },
        profileAnswers: [],
        conversationId: null,
        isFollowing: false,
        followerCount: 0,
        location: null,
      };
      mockedGetDiscoverUser.mockResolvedValue(profile);

      const res = await request(app)
        .get("/discover/users/target-1")
        .set("Authorization", "Bearer test");

      expect(res.status).toBe(200);
      expect(mockedGetDiscoverUser).toHaveBeenCalledWith("viewer-1", "target-1");
      expect(res.body).toEqual(profile);
      expect(res.body.practiceGoals).toEqual(["Conversation"]);
      expect(res.body).not.toHaveProperty("email");
    });

    it("requires authentication for GET /discover/users/:id", async () => {
      const res = await request(app).get("/discover/users/target-1");
      expect(res.status).toBe(401);
      expect(mockedGetDiscoverUser).not.toHaveBeenCalled();
    });
  });
});
