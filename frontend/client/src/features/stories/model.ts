import { STORY_STILL_DURATION_MS, type StoryDto, type StoryGroupDto } from "@sayly/shared";

/** How long a story stays on screen: the voice note's length, otherwise a fixed beat. */
export function storyDisplayMs(story: Pick<StoryDto, "mediaType" | "durationMs">): number {
  if (story.mediaType === "VOICE" && story.durationMs && story.durationMs > 0) {
    return story.durationMs;
  }
  return STORY_STILL_DURATION_MS;
}

/** "now", "12m", "5h" — the compact age shown next to the author. */
export function storyAgeLabel(createdAt: string, now: number = Date.now()): string {
  const minutes = Math.floor((now - Date.parse(createdAt)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

export function hasUnseen(group: StoryGroupDto, seen: ReadonlySet<string>): boolean {
  return group.stories.some((story) => !seen.has(story.id));
}

/** Where to start an author's stories: the first one not seen yet, or the beginning. */
export function firstUnseenIndex(group: StoryGroupDto, seen: ReadonlySet<string>): number {
  const index = group.stories.findIndex((story) => !seen.has(story.id));
  return index === -1 ? 0 : index;
}

/** Authors with something new come first; each part keeps the server's order. */
export function orderGroups(groups: StoryGroupDto[], seen: ReadonlySet<string>): StoryGroupDto[] {
  const fresh = groups.filter((group) => hasUnseen(group, seen));
  const watched = groups.filter((group) => !hasUnseen(group, seen));
  return [...fresh, ...watched];
}

export type StoryPosition = { group: number; story: number };

/** The next story, crossing into the next author; null at the very end. */
export function nextPosition(
  groups: readonly StoryGroupDto[],
  at: StoryPosition,
): StoryPosition | null {
  const current = groups[at.group];
  if (current && at.story + 1 < current.stories.length) {
    return { group: at.group, story: at.story + 1 };
  }
  return at.group + 1 < groups.length ? { group: at.group + 1, story: 0 } : null;
}

/** The previous story, crossing back to the previous author's last one; stays put at the start. */
export function previousPosition(
  groups: readonly StoryGroupDto[],
  at: StoryPosition,
): StoryPosition {
  if (at.story > 0) return { group: at.group, story: at.story - 1 };
  const previous = groups[at.group - 1];
  if (previous) return { group: at.group - 1, story: Math.max(0, previous.stories.length - 1) };
  return at;
}

/** Stable pick from a list, so a text story keeps its background between refreshes. */
export function pickStable<const O extends readonly [unknown, ...unknown[]]>(
  id: string,
  options: O,
): O[number] {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  return options[Math.abs(hash) % options.length] ?? options[0];
}
