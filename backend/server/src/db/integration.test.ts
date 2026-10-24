/**
 * Runs only when TEST_DATABASE_URL points at an EMPTY Postgres with migrations applied
 * (CI runs the ordered Drizzle journal into a throwaway container). Never point this at a real database:
 * it inserts and deletes rows.
 */
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
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
});
