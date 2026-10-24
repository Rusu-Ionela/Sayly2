import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = vi.fn();
vi.mock("../../db/client", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ orderBy: async () => rows() }) }),
    }),
  },
}));

const emitMessageCorrected = vi.fn();
const notifyCorrection = vi.fn();
const correctMessage = vi.fn();
vi.mock("./gateway", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./gateway")>()),
  emitMessageCorrected,
}));
vi.mock("../notifications", () => ({ notifyCorrection, notifyNewMessage: vi.fn() }));
vi.mock("./service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./service")>()),
  correctMessage,
}));

const { withLatestCorrections } = await import("./corrections");
const controller = await import("./controller");

const at = (iso: string) => new Date(iso);
const correctionRow = (id: string, messageId: string, text: string, iso: string) => ({
  id,
  messageId,
  authorId: "james",
  correctedText: text,
  note: null,
  createdAt: at(iso),
});

describe("latest correction per message", () => {
  beforeEach(() => vi.clearAllMocks());

  it("attaches the newest correction and null when there is none", async () => {
    // Ordered newest first, as the query does.
    rows.mockReturnValue([
      correctionRow("k2", "m1", "I have two cats", "2026-10-20T10:05:00Z"),
      correctionRow("k1", "m1", "I have a cat", "2026-10-20T10:01:00Z"),
    ]);
    const messages = [{ id: "m1" }, { id: "m2" }] as Parameters<typeof withLatestCorrections>[0];

    const result = await withLatestCorrections(messages);

    expect(result[0]?.correction?.correctedText).toBe("I have two cats");
    expect(result[1]?.correction).toBeNull();
  });
});

describe("POST /conversations/:id/messages/:messageId/corrections", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves, pushes the correction to both people in real time, and notifies the author", async () => {
    const correction = {
      id: "k1",
      messageId: "m1",
      authorId: "james",
      correctedText: "I have a cat",
      note: null,
      createdAt: "2026-10-20T10:01:00.000Z",
    };
    correctMessage.mockResolvedValue({ correction, messageSenderId: "maria" });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const req = {
      params: { id: "c1", messageId: "m1" },
      body: { correctedText: "I have a cat" },
      user: { id: "james" },
    };

    await controller.correctMessage(req as never, res as never);

    expect(correctMessage).toHaveBeenCalledWith("james", "c1", "m1", "I have a cat", undefined);
    expect(emitMessageCorrected).toHaveBeenCalledWith(
      { conversationId: "c1", messageId: "m1", correction },
      ["maria", "james"],
    );
    expect(notifyCorrection).toHaveBeenCalledWith(correction, "maria", "c1");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(correction);
  });
});
