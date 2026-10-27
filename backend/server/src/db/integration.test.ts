/**
 * Runs only when TEST_DATABASE_URL points at an EMPTY Postgres with migrations applied
 * (CI runs the ordered Drizzle journal into a throwaway container). Never point this at a real database:
 * it inserts and deletes rows.
 */
import { createId } from "@paralleldrive/cuid2";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("real Postgres", () => {
  let db: typeof import("./client").db;
  let schema: typeof import("./schema");
  let isUniqueViolation: typeof import("./errors").isUniqueViolation;
  let setConversationPinned: typeof import("../features/messaging/repository").setConversationPinned;
  let getOrCreateDirectConversation: typeof import("../features/messaging/repository").getOrCreateDirectConversation;
  let closeDb: typeof import("./client").closeDb;

  const makeUser = async () => {
    const id = createId();
    await db.insert(schema.users).values({ id, email: `${id}@test.invalid`, passwordHash: "x" });
    return id;
  };

  const openAcceptedDirect = async (a: string, b: string) => {
    await db.insert(schema.connections).values({ requesterId: a, recipientId: b, status: "ACCEPTED" });
    return getOrCreateDirectConversation(a, b);
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db, closeDb } = await import("./client"));
    schema = await import("./schema");
    ({ isUniqueViolation } = await import("./errors"));
    ({ setConversationPinned, getOrCreateDirectConversation } = await import(
      "../features/messaging/repository"
    ));
  });

  afterAll(async () => {
    await closeDb?.();
  });

  it("rejects a second message with the same sender and clientMessageId", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const { conversationId } = await openAcceptedDirect(a, b);
    const row = { conversationId, senderId: a, type: "TEXT" as const, content: "hi", clientMessageId: "k1" };
    await db.insert(schema.messages).values(row);
    const error = await db.insert(schema.messages).values(row).catch((e: unknown) => e);
    expect(isUniqueViolation(error)).toBe(true);
  });

  it("refuses a user blocking themselves", async () => {
    const a = await makeUser();
    await expect(db.insert(schema.blocks).values({ blockerId: a, blockedId: a })).rejects.toBeTruthy();
  });

  it("creates a new direct chat only after the pair accepts a connection", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    await expect(getOrCreateDirectConversation(a, b)).rejects.toMatchObject({
      code: "CONNECTION_REQUIRED",
      statusCode: 403,
    });
    const { conversationId } = await openAcceptedDirect(a, b);
    const repeat = await getOrCreateDirectConversation(a, b);
    expect(repeat).toEqual({ conversationId, created: false });
  });

  it("allows at most 3 pinned chats", async () => {
    const me = await makeUser();
    const chats: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      chats.push((await openAcceptedDirect(me, await makeUser())).conversationId);
    }
    for (const id of chats.slice(0, 3)) await setConversationPinned(me, id, true);
    await expect(setConversationPinned(me, chats[3]!, true)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("includes every currently modeled profile, support, and public-ID database object", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const [user] = await db.query.users.findMany({ where: (u, { eq }) => eq(u.id, a) });
    expect(user?.saylyId).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);

    await db.insert(schema.userSettings).values({ userId: a, translateTo: "es" });
    await db.insert(schema.onboardingDrafts).values({
      userId: a,
      step: "questions",
      questionIndex: 1,
      draft: { firstName: "Ada", answers: ["", "A saved answer", ""] },
    });
    await db.insert(schema.conversationTopics).values({ id: createId(), userId: a, title: "Travel" });
    await db.insert(schema.profileViews).values({ viewerId: a, viewedId: b });
    await db.insert(schema.supportTickets).values({
      id: createId(),
      userId: a,
      kind: "BUG_REPORT",
      topic: "ACCOUNT",
      subject: "Migration coverage",
      message: "The table and enum are available.",
      contactEmail: "support-test@example.invalid",
      platform: "WEB",
    });
    await db.insert(schema.references).values({ id: createId(), authorId: a, subjectId: b, body: "Great partner" });

    const [report] = await db
      .insert(schema.reports)
      .values({ reporterId: a, reportedId: b, reason: "Harassment", details: "Migration coverage" })
      .returning();
    expect(report?.status).toBe("PENDING");
    const [reviewed] = await db
      .update(schema.reports)
      .set({ status: "RESOLVED", reviewerId: a, reviewedAt: new Date(), reviewNote: "Reviewed in test" })
      .where(eq(schema.reports.id, report!.id))
      .returning();
    expect(reviewed?.reviewNote).toBe("Reviewed in test");

    const [reference] = await db.query.references.findMany({ where: (r, { eq }) => eq(r.authorId, a) });
    expect(reference?.rating).toBe(5);
  });

  it("counts a streak day once, grows on consecutive days and restarts after a gap", async () => {
    const { countActiveDay, findStreak } = await import("../features/streaks/repository");
    const a = await makeUser();

    expect(await countActiveDay(a, "2026-10-20", "Europe/Bucharest")).toMatchObject({
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: "2026-10-20",
      timezone: "Europe/Bucharest",
    });
    // Same day twice (e.g. two messages at once): only one of the calls moves it.
    const sameDay = await Promise.all([countActiveDay(a, "2026-10-21", undefined), countActiveDay(a, "2026-10-21", undefined)]);
    expect(sameDay.filter(Boolean)).toHaveLength(1);
    expect(await findStreak(a)).toMatchObject({ currentStreak: 2, longestStreak: 2 });

    expect(await countActiveDay(a, "2026-10-20", undefined)).toBeNull();
    expect(await countActiveDay(a, "2026-10-25", undefined)).toMatchObject({ currentStreak: 1, longestStreak: 2 });
  });

  it("keeps one icebreaker answer per member and day, hidden across blocks", async () => {
    const repo = await import("../features/icebreakers/repository");
    await db
      .insert(schema.languages)
      .values({ id: "es", code: "es", name: "Spanish", flagEmoji: "", sortOrder: 2 })
      .onConflictDoNothing();
    const [viewer, author, blocked] = [await makeUser(), await makeUser(), await makeUser()];
    await db
      .update(schema.users)
      .set({ onboardingCompleted: true })
      .where(inArray(schema.users.id, [viewer, author, blocked]));
    const day = { languageId: "es", promptDate: "2026-10-24" };

    await repo.saveAnswer(author, { ...day, promptId: "ib01", body: "Tostadas" });
    await repo.saveAnswer(author, { ...day, promptId: "ib01", body: "Tostadas con tomate" });
    await repo.saveAnswer(blocked, { ...day, promptId: "ib01", body: "Hidden" });
    await db.insert(schema.blocks).values({ blockerId: viewer, blockedId: blocked });

    expect(await repo.findOwnAnswer(author, day)).toMatchObject({ body: "Tostadas con tomate" });
    expect(await repo.countVisibleAnswers(viewer, day)).toBe(1);
    const page = await repo.listVisibleAnswers(viewer, day);
    expect(page.rows.map((row) => row.userId)).toEqual([author]);
    expect(await repo.deleteAnswer(author, day)).toBe(true);
    expect(await repo.countVisibleAnswers(viewer, day)).toBe(0);
  });

  it("claims streak reminders once a day, in the member's evening, unless opted out", async () => {
    const { claimDueReminders } = await import("../features/streaks/reminders");
    const [due, optedOut, noPhone] = [await makeUser(), await makeUser(), await makeUser()];
    for (const userId of [due, optedOut, noPhone]) {
      // Alive yesterday (Bucharest), nothing today.
      await db.insert(schema.userStreaks).values({
        userId,
        currentStreak: 4,
        longestStreak: 4,
        lastActiveDate: "2026-10-23",
        timezone: "Europe/Bucharest",
      });
    }
    await db.insert(schema.pushTokens).values([
      { token: `ExponentPushToken[${due}]`, userId: due, platform: "ios" },
      { token: `ExponentPushToken[${optedOut}]`, userId: optedOut, platform: "ios" },
    ]);
    await db.insert(schema.userSettings).values({ userId: optedOut, notifyStreakReminders: false });

    // 15:00 in Bucharest: too early.
    expect(await claimDueReminders(new Date("2026-10-24T12:00:00Z"))).toEqual([]);
    // 20:00 in Bucharest: only the member with a phone and reminders on, and only once.
    const evening = new Date("2026-10-24T17:00:00Z");
    const [first, second] = await Promise.all([claimDueReminders(evening), claimDueReminders(evening)]);
    const claimed = [...first, ...second].filter((row) => [due, optedOut, noPhone].includes(row.userId));
    expect(claimed).toEqual([{ userId: due, currentStreak: 4 }]);
    expect(
      (await claimDueReminders(new Date("2026-10-24T19:30:00Z"))).some((row) => row.userId === due),
    ).toBe(false);
  });
});
