import { describe, expect, it } from "vitest";

import {
  assertNoSensitivePublicFields,
  FORBIDDEN_PUBLIC_PROFILE_KEYS,
  toCurrentUserDto,
  toPublicProfileDto,
  toSafePublicProfileDto,
} from "./dto";
import { DEFAULT_SETTINGS, toUserSettingsDto, visibleLocation } from "./settings";
import type { PublicProfileSource } from "./dto";

const source: PublicProfileSource = {
  id: "user-public-1",
  isPro: true,
  onboardingCompleted: true,
  settings: null,
  conversationTopics: [{ title: "Japanese street food" }],
  referenceSummary: { total: 3, positive: 2 },
  certificates: [
    {
      id: "cert-1",
      languageId: "en",
      level: "B2",
      title: "IELTS",
      issuedYear: 2023,
      language: { name: "English", flagEmoji: "🇬🇧" },
    },
  ],
  profile: {
    displayName: "Yuki",
    bio: "Hello",
    country: "Japan",
    city: "Osaka",
    profileImageUrl: "https://cdn.example/yuki.png",
    practiceGoals: ["Conversation"],
    topics: ["Travel"],
    photos: [],
    dateOfBirth: new Date("1998-01-01"),
    age: 28,
    profileCompleted: true,
  },
  languages: [
    {
      languageId: "ja",
      type: "SPEAKS",
      proficiencyLevel: "NATIVE",
      language: { code: "ja", name: "Japanese", flagEmoji: "🇯🇵" },
    },
    {
      languageId: "en",
      type: "LEARNING",
      proficiencyLevel: "INTERMEDIATE",
      language: { code: "en", name: "English", flagEmoji: "🇬🇧" },
    },
  ],
};

describe("PRO-003 privacy-safe public DTOs", () => {
  it("toSafePublicProfileDto omits email, DOB, auth, and account flags", () => {
    const dto = toSafePublicProfileDto(source, {
      conversationId: null,
      onlineStatus: "ONLINE",
      isFollowing: false,
      followerCount: 0,
    });

    expect(dto).toEqual({
      isPro: true,
      city: "Osaka",
      topics: ["Travel"],
      photos: [],
      certificates: [
        {
          id: "cert-1",
          languageId: "en",
          languageName: "English",
          flagEmoji: "🇬🇧",
          level: "B2",
          title: "IELTS",
          issuedYear: 2023,
        },
      ],
      onlineStatus: "ONLINE",
      id: "user-public-1",
      displayName: "Yuki",
      avatarUrl: "https://cdn.example/yuki.png",
      profileImageUrl: "https://cdn.example/yuki.png",
      country: "Japan",
      bio: "Hello",
      spokenLanguages: [
        { languageId: "ja", code: "ja", name: "Japanese", flagEmoji: "🇯🇵", proficiency: "NATIVE" },
      ],
      learningLanguages: [
        { languageId: "en", code: "en", name: "English", flagEmoji: "🇬🇧", proficiency: "INTERMEDIATE" },
      ],
      practiceGoals: ["Conversation"],
      profileAnswers: [],
      conversationId: null,
      mainTopic: "Japanese street food",
      references: { total: 3, positive: 2 },
      learningPreferences: { communication: [], timeCommitment: null, schedule: [], correction: null },
      isFollowing: false,
      followerCount: 0,
      location: null,
    });

    assertNoSensitivePublicFields(dto as unknown as Record<string, unknown>);
    expect(dto).not.toHaveProperty("age");
    expect(dto).not.toHaveProperty("email");
    expect(dto).not.toHaveProperty("passwordHash");
  });

  it("toPublicProfileDto stays free of auth/email fields", () => {
    const dto = toPublicProfileDto(source, {
      conversationId: null,
      onlineStatus: "UNKNOWN",
      isFollowing: false,
      followerCount: 0,
    });

    assertNoSensitivePublicFields(dto as unknown as Record<string, unknown>);
    for (const key of FORBIDDEN_PUBLIC_PROFILE_KEYS) {
      expect(dto).not.toHaveProperty(key);
    }
    expect(dto.age).toBe(28);
  });

  it("assertNoSensitivePublicFields throws when email leaks", () => {
    expect(() =>
      assertNoSensitivePublicFields({
        id: "x",
        displayName: "A",
        email: "secret@example.com",
      }),
    ).toThrow(/email/);
  });
});

describe("profile privacy settings", () => {
  const hidden: PublicProfileSource = {
    ...source,
    settings: { ...DEFAULT_SETTINGS, showLocation: false, showCertificates: false },
  };
  const ctx = {
    conversationId: null,
    onlineStatus: "UNKNOWN" as const,
    isFollowing: false,
    followerCount: 0,
  };

  it("hides country and city from others when showLocation is off", () => {
    const safe = toSafePublicProfileDto(hidden, ctx);
    expect(safe.country).toBe("");
    expect(safe.city).toBeNull();
    expect(toPublicProfileDto(hidden, ctx).country).toBe("");
  });

  it("hides certificates from others when showCertificates is off", () => {
    expect(toSafePublicProfileDto(hidden, ctx).certificates).toEqual([]);
    expect(toSafePublicProfileDto(source, ctx).certificates).toHaveLength(1);
  });

  it("never exposes settings, stats or the Sayly ID on public payloads", () => {
    const safe = toSafePublicProfileDto(hidden, ctx) as unknown as Record<string, unknown>;
    expect(safe).not.toHaveProperty("settings");
    expect(safe).not.toHaveProperty("stats");
    expect(safe).not.toHaveProperty("saylyId");
  });

  it("still shows the owner their own country, city and certificates", () => {
    const me = toCurrentUserDto({
      ...hidden,
      email: "yuki@example.test",
      saylyId: "K7QF3MZA",
      stats: { savedPhrases: 0, groups: 0, following: 2, newVisitors: 5 },
    });
    expect(me.country).toBe("Japan");
    expect(me.city).toBe("Osaka");
    expect(me.certificates).toHaveLength(1);
    expect(me.saylyId).toBe("K7QF3MZA");
    expect(me.mainTopic).toBe("Japanese street food");
    expect(me.settings.showLocation).toBe(false);
    expect(me.settings.showCertificates).toBe(false);
  });
});

describe("visibleLocation", () => {
  const profile = { country: "Japan", city: "Osaka" };

  it("returns country and city when the owner shares them", () => {
    expect(visibleLocation(profile, { showLocation: true })).toEqual(profile);
  });

  it("treats a missing settings row as the default (visible)", () => {
    expect(visibleLocation(profile, null)).toEqual(profile);
  });

  it("blanks both when showLocation is off", () => {
    expect(visibleLocation(profile, { showLocation: false })).toEqual({ country: "", city: null });
  });

  it("normalises a missing profile", () => {
    expect(visibleLocation(null, null)).toEqual({ country: "", city: null });
  });
});

describe("settings defaults", () => {
  it("a user without a UserSettings row gets every default", () => {
    expect(toUserSettingsDto(null, undefined)).toEqual({ discoverable: true, ...DEFAULT_SETTINGS });
  });

  it("keeps Discover visibility from the profile", () => {
    expect(toUserSettingsDto(null, false).discoverable).toBe(false);
  });
});
