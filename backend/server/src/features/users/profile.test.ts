import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { MAX_AVATAR_BYTES, MAX_PROFILE_PHOTOS, normalizeCountryInput } from "@sayly/shared";

vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"));

vi.mock("./service", () => ({
  getMe: vi.fn(),
  completeOnboarding: vi.fn(),
  getOnboardingDraft: vi.fn(),
  saveOnboardingDraft: vi.fn(),
  updateProfile: vi.fn(),
  getUserById: vi.fn(),
  getPublicProfile: vi.fn(),
  updateLanguages: vi.fn(),
  getMyLanguages: vi.fn(),
  putMyLanguages: vi.fn(),
  softDeleteAccount: vi.fn(),
  changePassword: vi.fn(),
  updateSettings: vi.fn(),
}));

import { createApp } from "../../lib/app";
import * as usersService from "./service";
import { onboardingDraftSchema, updateProfileSchema, updateSettingsSchema } from "./schema";

const mockedService = vi.mocked(usersService);

describe("PRO-001 / PRO-002 profile API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("country normalization", () => {
    it("accepts ISO-2 and English country names", () => {
      expect(normalizeCountryInput("ro")).toBe("RO");
      expect(normalizeCountryInput("Romania")).toBe("RO");
      expect(normalizeCountryInput("Narnia")).toBeNull();
    });
  });

  describe("Zod validation", () => {
    it("rejects displayName shorter than 2 or longer than 50", () => {
      expect(() => updateProfileSchema.parse({ displayName: "A" })).toThrow();
      expect(() => updateProfileSchema.parse({ displayName: "x".repeat(51) })).toThrow();
      expect(updateProfileSchema.parse({ displayName: "Ada" }).displayName).toBe("Ada");
    });

    it("rejects invalid country and overlong bio", () => {
      expect(() => updateProfileSchema.parse({ country: "XX" })).toThrow();
      expect(() => updateProfileSchema.parse({ bio: "b".repeat(501) })).toThrow();
      expect(updateProfileSchema.parse({ country: "DE" }).country).toBe("DE");
    });

    it("requires spoken and learning languages together on PUT profile", () => {
      expect(() =>
        updateProfileSchema.parse({
          spokenLanguages: [{ languageId: "en", proficiency: "NATIVE" }],
        }),
      ).toThrow();

      const parsed = updateProfileSchema.parse({
        displayName: "Ionela",
        practiceGoals: ["Conversation", "Grammar"],
        spokenLanguages: [{ languageId: "ro", proficiency: "NATIVE" }],
        learningLanguages: [{ languageId: "en", proficiency: "INTERMEDIATE" }],
      });

      expect(parsed.displayName).toBe("Ionela");
      expect(parsed.practiceGoals).toEqual(["Conversation", "Grammar"]);
      expect(parsed.languages?.spokenLanguages[0]?.proficiency).toBe("NATIVE");
    });

    it("sanitizes display name and bio before length checks", () => {
      const parsed = updateProfileSchema.parse({
        displayName: "  Ana\u200B\u202E  Maria\u0007 ",
        bio: "Salut!\r\n\r\n\r\n\r\nI   love\ttea \u0000",
      });

      expect(parsed.displayName).toBe("Ana Maria");
      expect(parsed.bio).toBe("Salut!\n\nI love tea");
      // Only invisible characters → empty after sanitizing → too short.
      expect(() => updateProfileSchema.parse({ displayName: "\u200B\u200B\u200B" })).toThrow();
    });

    it("keeps emoji ZWJ sequences in names", () => {
      const family = "Ana \u{1F468}\u200D\u{1F469}\u200D\u{1F467}";
      expect(updateProfileSchema.parse({ displayName: family }).displayName).toBe(family);
    });

    it("allows clearing practice goals", () => {
      expect(updateProfileSchema.parse({ practiceGoals: [] }).practiceGoals).toEqual([]);
    });

    it("accepts partial onboarding state but bounds its resume cursor", () => {
      const draft = {
        step: "questions" as const,
        questionIndex: 1,
        draft: {
          firstName: "Ada",
          lastName: "Lovelace",
          dateOfBirth: "1815-12-10",
          gender: "FEMALE" as const,
          skipFluent: false,
          spokenLanguages: [],
          learningLanguages: [],
          answers: ["", "Still writing this answer", ""],
          country: "",
        },
      };
      expect(onboardingDraftSchema.parse(draft)).toEqual(draft);
      expect(() => onboardingDraftSchema.parse({ ...draft, questionIndex: 3 })).toThrow();
    });
  });

  describe("avatar validation", () => {
    const png = (bytes: number) => {
      const data = Buffer.alloc(bytes);
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(data);
      return `data:image/png;base64,${data.toString("base64")}`;
    };

    it("accepts a base64 image up to 2 MB as an inline avatar", () => {
      const parsed = updateProfileSchema.parse({ avatarUrl: png(MAX_AVATAR_BYTES) });
      expect(parsed.avatar).toMatchObject({ kind: "inline", mimeType: "image/png" });
    });

    it("rejects base64 images over 2 MB", () => {
      expect(() => updateProfileSchema.parse({ avatarUrl: png(MAX_AVATAR_BYTES + 1) })).toThrow(
        /2 MB/,
      );
    });

    it("rejects data URIs whose bytes do not match the declared type", () => {
      const html = Buffer.from("<html><script>alert(1)</script></html>").toString("base64");
      expect(() =>
        updateProfileSchema.parse({ avatarUrl: `data:image/png;base64,${html}` }),
      ).toThrow();
      expect(() =>
        updateProfileSchema.parse({ avatarUrl: `data:image/svg+xml;base64,${html}` }),
      ).toThrow();
    });

    it("accepts only our own uploads as URLs (they can be face-checked)", () => {
      expect(() => updateProfileSchema.parse({ profileImageUrl: "https://cdn.example/a.png" })).toThrow(
        "Upload your profile photo from your device",
      );
      expect(
        updateProfileSchema.parse({ avatarUrl: "http://192.168.1.5:4000/media/files/abc.jpg?exp=1&sig=x" })
          .avatar,
      ).toEqual({ kind: "url", url: "http://192.168.1.5:4000/media/files/abc.jpg?exp=1&sig=x" });
      expect(updateProfileSchema.parse({ photoUrl: "/media/files/abc.jpg" }).avatar).toEqual({
        kind: "url",
        url: "/media/files/abc.jpg",
      });
      expect(() => updateProfileSchema.parse({ avatarUrl: "javascript:alert(1)" })).toThrow();
    });

    it("treats an explicit null or empty string as 'remove photo'", () => {
      expect(updateProfileSchema.parse({ avatarUrl: null }).avatar).toBeNull();
      expect(updateProfileSchema.parse({ profileImageUrl: "" }).avatar).toBeNull();
      expect(updateProfileSchema.parse({ displayName: "Ada" }).avatar).toBeUndefined();
    });
  });

  describe("HTTP routes", () => {
    const app = createApp();

    it("saves and returns an incomplete onboarding draft for the signed-in member", async () => {
      const draft = {
        step: "questions" as const,
        questionIndex: 1,
        draft: {
          firstName: "Ada",
          lastName: "Lovelace",
          dateOfBirth: "1815-12-10",
          gender: "FEMALE" as const,
          skipFluent: false,
          spokenLanguages: [],
          learningLanguages: [],
          answers: ["", "Still writing this answer", ""] as [string, string, string],
          country: "",
        },
      };
      mockedService.getOnboardingDraft.mockResolvedValueOnce(draft);
      mockedService.saveOnboardingDraft.mockResolvedValueOnce(draft);

      await request(app)
        .get("/users/me/onboarding-draft")
        .set("Authorization", "Bearer test")
        .expect(200, draft);
      await request(app)
        .put("/users/me/onboarding-draft")
        .set("Authorization", "Bearer test")
        .send(draft)
        .expect(200, draft);

      expect(mockedService.getOnboardingDraft).toHaveBeenCalledWith("viewer-1");
      expect(mockedService.saveOnboardingDraft).toHaveBeenCalledWith("viewer-1", draft);
    });

    it("GET /users/:id/public-profile returns safe DTO", async () => {
      mockedService.getPublicProfile.mockResolvedValue({
        id: "target-1",
        displayName: "Yuki",
        avatarUrl: null,
        profileImageUrl: null,
        country: "JP",
        bio: "Hello",
        spokenLanguages: [],
        learningLanguages: [],
        practiceGoals: ["Conversation"],
        onlineStatus: "UNKNOWN",
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
      });

      const res = await request(app).get("/users/target-1/public-profile").set("Authorization", "Bearer test");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: "target-1",
        displayName: "Yuki",
        avatarUrl: null,
        profileImageUrl: null,
        country: "JP",
        bio: "Hello",
        spokenLanguages: [],
        learningLanguages: [],
        practiceGoals: ["Conversation"],
        onlineStatus: "UNKNOWN",
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
      });
      expect(res.body).not.toHaveProperty("email");
      expect(res.body).not.toHaveProperty("passwordHash");
      expect(res.body).not.toHaveProperty("authProvider");
      expect(res.body).not.toHaveProperty("dateOfBirth");
      expect(res.body).not.toHaveProperty("status");
      expect(mockedService.getPublicProfile).toHaveBeenCalledWith("viewer-1", "target-1");
    });

    it("PUT /users/me/profile validates and updates profile", async () => {
      mockedService.updateProfile.mockResolvedValue({
        id: "viewer-1",
        saylyId: "AB23CD45",
        email: "me@example.com",
        onboardingCompleted: true,
        profileCompleted: true,
        displayName: "Ionela",
        bio: "Learning daily",
        country: "RO",
        dateOfBirth: null,
        age: null,
        practiceGoals: ["Speaking"],
        spokenLanguages: [],
        learningLanguages: [],
        nativeLanguages: [],
        isPro: false,
        city: null,
        topics: [],
        photos: [],
        certificates: [],
        mainTopic: null,
        references: { total: 0, positive: 0 },
        learningPreferences: { communication: [], timeCommitment: null, schedule: [], correction: null },
        settings: {
          discoverable: true,
          showOnlineStatus: true,
          showLocation: true,
          notifyMessages: true,
          notifyConnectionRequests: true,
          notifyGroupActivity: true,
          notifyStreakReminders: true,
          showSaylyId: true,
          showCertificates: true,
          translateTo: null,
        },
        stats: { savedPhrases: 0, groups: 0, following: 0, newVisitors: 0 },
        firstName: "",
        lastName: "",
        gender: null,
        profileAnswers: [],
        location: null,
      });

      const res = await request(app)
        .put("/users/me/profile")
        .set("Authorization", "Bearer test")
        .send({
          displayName: "Ionela",
          bio: "Learning daily",
          country: "RO",
          practiceGoals: ["Speaking"],
        });

      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe("Ionela");
      expect(res.body.profileCompleted).toBe(true);
      expect(mockedService.updateProfile).toHaveBeenCalled();
    });

    it("PATCH /users/me uses the same contract and handler as PUT /users/me/profile", async () => {
      mockedService.updateProfile.mockResolvedValue({} as never);

      const res = await request(app)
        .patch("/users/me")
        .set("Authorization", "Bearer test")
        .send({
          practiceGoals: ["Grammar"],
          spokenLanguages: [{ languageId: "ro", proficiency: "NATIVE" }],
          learningLanguages: [{ languageId: "en", proficiency: "BEGINNER" }],
        });

      expect(res.status).toBe(200);
      expect(mockedService.updateProfile).toHaveBeenCalledWith(
        "viewer-1",
        expect.objectContaining({
          practiceGoals: ["Grammar"],
          languages: {
            spokenLanguages: [{ languageId: "ro", proficiency: "NATIVE" }],
            learningLanguages: [{ languageId: "en", proficiency: "BEGINNER" }],
          },
        }),
      );
    });

    it("rejects unauthenticated profile reads", async () => {
      const res = await request(app).get("/users/target-1/public-profile");
      expect(res.status).toBe(401);
      expect(mockedService.getPublicProfile).not.toHaveBeenCalled();
    });

    it("PUT /users/me/profile returns 400 on validation error", async () => {
      const res = await request(app)
        .put("/users/me/profile")
        .set("Authorization", "Bearer test")
        .send({ displayName: "A", bio: "x".repeat(501) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(mockedService.updateProfile).not.toHaveBeenCalled();
    });
  });
});

describe("profile showcase fields", () => {
  it("accepts topics, city, gallery photos and certificates", () => {
    const parsed = updateProfileSchema.parse({
      city: "  Cluj-Napoca ",
      topics: ["Travel", "Music"],
      photos: ["/media/files/abc123.jpg", "https://api.sayly.app/media/files/def456.png?exp=1&sig=x"],
      certificates: [{ languageId: "en", level: "C1", title: "IELTS", issuedYear: 2022 }],
    });

    expect(parsed.city).toBe("Cluj-Napoca");
    expect(parsed.topics).toEqual(["Travel", "Music"]);
    // Signed URLs are normalised to the stable stored path.
    expect(parsed.photos).toEqual(["/media/files/abc123.jpg", "/media/files/def456.png"]);
    expect(parsed.certificates).toEqual([
      { languageId: "en", level: "C1", title: "IELTS", issuedYear: 2022 },
    ]);
  });

  it("clears the city with an empty string", () => {
    expect(updateProfileSchema.parse({ city: "" }).city).toBeNull();
  });

  it("rejects unknown topics, duplicates and oversized galleries", () => {
    expect(() => updateProfileSchema.parse({ topics: ["Knitting"] })).toThrow();
    expect(() => updateProfileSchema.parse({ topics: ["Travel", "Travel"] })).toThrow();
    const tooMany = Array.from({ length: MAX_PROFILE_PHOTOS + 1 }, (_, i) => `/media/files/p${i}.jpg`);
    expect(() => updateProfileSchema.parse({ photos: tooMany })).toThrow();
  });

  it("rejects external gallery URLs, invalid CEFR levels and future years", () => {
    expect(() => updateProfileSchema.parse({ photos: ["https://tracker.example/pixel.gif"] })).toThrow();
    expect(() =>
      updateProfileSchema.parse({ certificates: [{ languageId: "en", level: "D1", title: "IELTS" }] }),
    ).toThrow();
    expect(() =>
      updateProfileSchema.parse({
        certificates: [{ languageId: "en", level: "B2", title: "IELTS", issuedYear: 3000 }],
      }),
    ).toThrow();
  });

  it("no longer accepts account toggles on the profile contract", () => {
    expect(() => updateProfileSchema.parse({ discoverable: false })).toThrow();
  });
});

describe("PATCH /users/me/settings", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts partial toggles and rejects unknown or empty payloads", () => {
    expect(updateSettingsSchema.parse({ showOnlineStatus: false })).toEqual({ showOnlineStatus: false });
    expect(() => updateSettingsSchema.parse({})).toThrow();
    expect(() => updateSettingsSchema.parse({ isPro: true })).toThrow();
    expect(() => updateSettingsSchema.parse({ notifyMessages: "yes" })).toThrow();
  });

  it("passes the parsed toggles to the service", async () => {
    mockedService.updateSettings.mockResolvedValue({} as never);

    const res = await request(app)
      .patch("/users/me/settings")
      .set("Authorization", "Bearer test")
      .send({ discoverable: false, notifyGroupActivity: false });

    expect(res.status).toBe(200);
    expect(mockedService.updateSettings).toHaveBeenCalledWith("viewer-1", {
      discoverable: false,
      notifyGroupActivity: false,
    });
  });

  it("requires authentication", async () => {
    const res = await request(app).patch("/users/me/settings").send({ showLocation: false });
    expect(res.status).toBe(401);
    expect(mockedService.updateSettings).not.toHaveBeenCalled();
  });
});
