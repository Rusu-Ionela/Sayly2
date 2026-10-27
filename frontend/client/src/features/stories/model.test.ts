import type { StoryDto, StoryGroupDto } from "@sayly/shared";

import {
  firstUnseenIndex,
  nextPosition,
  orderGroups,
  pickStable,
  previousPosition,
  storyAgeLabel,
  storyDisplayMs,
} from "./model";

function story(id: string, overrides: Partial<StoryDto> = {}): StoryDto {
  return {
    id,
    authorId: "a",
    mediaType: "TEXT",
    mediaUrl: null,
    textContent: "hola",
    durationMs: null,
    targetLanguage: "es",
    languageName: "Spanish",
    flagEmoji: null,
    createdAt: "2026-10-27T08:00:00.000Z",
    expiresAt: "2026-10-28T08:00:00.000Z",
    ...overrides,
  };
}

function group(authorId: string, ids: string[]): StoryGroupDto {
  return {
    author: { id: authorId, displayName: authorId, avatarUrl: null },
    stories: ids.map((id) => story(id, { authorId })),
  };
}

const groups = [group("ana", ["a1", "a2"]), group("bo", ["b1"])];

describe("story model", () => {
  it("plays voice for its length and stills for five seconds", () => {
    expect(storyDisplayMs({ mediaType: "VOICE", durationMs: 12_000 })).toBe(12_000);
    expect(storyDisplayMs({ mediaType: "PHOTO", durationMs: null })).toBe(5_000);
  });

  it("labels the age compactly", () => {
    const now = Date.parse("2026-10-27T10:30:00.000Z");
    expect(storyAgeLabel("2026-10-27T10:29:45.000Z", now)).toBe("now");
    expect(storyAgeLabel("2026-10-27T10:18:00.000Z", now)).toBe("12m");
    expect(storyAgeLabel("2026-10-27T08:00:00.000Z", now)).toBe("2h");
  });

  it("starts at the first unseen story and puts fresh authors first", () => {
    const seen = new Set(["a1", "b1"]);
    expect(firstUnseenIndex(groups[0]!, seen)).toBe(1);
    expect(firstUnseenIndex(groups[1]!, seen)).toBe(0);
    expect(orderGroups([groups[1]!, groups[0]!], seen).map((g) => g.author.id)).toEqual([
      "ana",
      "bo",
    ]);
  });

  it("moves across authors and stops at the ends", () => {
    expect(nextPosition(groups, { group: 0, story: 0 })).toEqual({ group: 0, story: 1 });
    expect(nextPosition(groups, { group: 0, story: 1 })).toEqual({ group: 1, story: 0 });
    expect(nextPosition(groups, { group: 1, story: 0 })).toBeNull();
    expect(previousPosition(groups, { group: 1, story: 0 })).toEqual({ group: 0, story: 1 });
    expect(previousPosition(groups, { group: 0, story: 0 })).toEqual({ group: 0, story: 0 });
  });

  it("picks the same option for the same id", () => {
    const options = ["x", "y", "z"] as const;
    expect(pickStable("st1", options)).toBe(pickStable("st1", options));
  });
});
