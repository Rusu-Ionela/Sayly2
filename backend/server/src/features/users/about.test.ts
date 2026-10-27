import { describe, expect, it } from "vitest";

import { toCurrentUserDto, toSafePublicProfileDto, type PublicProfileSource } from "./dto";

describe("about fields in serializers", () => {
  const source: PublicProfileSource = {
    id: "user-1",
    isPro: false,
    onboardingCompleted: true,
    settings: null,
    certificates: [],
    profile: {
      displayName: "Yuki",
      bio: "Hello",
      country: "Japan",
      profileImageUrl: null,
      practiceGoals: [],
      profileCompleted: true,
      dateOfBirth: null,
      age: 28,
      city: "Osaka",
      latitude: 34.69,
      longitude: 135.5,
      topics: ["Music"],
      photos: ["https://cdn.example/a.jpg"],
    },
    languages: [],
    conversationTopics: [],
    referenceSummary: { total: 2, positive: 1 },
  };
  const ctx = {
    conversationId: null,
    isFollowing: false,
    followerCount: 0,
    onlineStatus: "UNKNOWN" as const,
  };

  it("public profile exposes city, topics, photos and the map position", () => {
    const dto = toSafePublicProfileDto(source, ctx);
    expect(dto.city).toBe("Osaka");
    expect(dto.topics).toEqual(["Music"]);
    expect(dto.photos).toEqual(["https://cdn.example/a.jpg"]);
    expect(dto.location).toEqual({ latitude: 34.69, longitude: 135.5 });
    expect(dto.references).toEqual({ total: 2, positive: 1 });
  });

  it("hides the map position along with the country when showLocation is off", () => {
    const dto = toSafePublicProfileDto(
      {
        ...source,
        settings: {
          showOnlineStatus: true,
          showLocation: false,
          notifyMessages: true,
          notifyConnectionRequests: true,
          notifyGroupActivity: true,
        notifyStreakReminders: true,
          showSaylyId: true,
          showCertificates: true,
          translateTo: null,
        },
      },
      ctx,
    );
    expect(dto.location).toBeNull();
    expect(dto.city).toBeNull();
  });

  it("defaults to empty values when the profile has none", () => {
    const dto = toSafePublicProfileDto(
      {
        ...source,
        profile: { ...source.profile!, city: null, latitude: null, longitude: null, topics: [], photos: [] },
      },
      ctx,
    );
    expect(dto.city).toBeNull();
    expect(dto.topics).toEqual([]);
    expect(dto.photos).toEqual([]);
    expect(dto.location).toBeNull();
  });

  it("self profile exposes them too", () => {
    const dto = toCurrentUserDto({
      ...source,
      email: "a@b.c",
      saylyId: "SAYLY123",
      stats: { savedPhrases: 0, groups: 0, following: 0, newVisitors: 0 },
    });
    expect(dto.city).toBe("Osaka");
    expect(dto.photos).toHaveLength(1);
    expect(dto.location).toEqual({ latitude: 34.69, longitude: 135.5 });
  });
});
