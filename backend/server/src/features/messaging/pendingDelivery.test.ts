import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./service", () => ({
  markPendingDelivered: vi.fn(),
}));

vi.mock("./gateway", () => ({
  conversationRoom: (id: string) => `conversation:${id}`,
  userRoom: (id: string) => `user:${id}`,
  emitMessageStatus: vi.fn(),
  emitNewMessage: vi.fn(),
  emitTyping: vi.fn(),
}));

import * as gateway from "./gateway";
import * as messagingService from "./service";
import { deliverPendingMessages } from "./socket";

const mockedPending = vi.mocked(messagingService.markPendingDelivered);
const mockedEmit = vi.mocked(gateway.emitMessageStatus);

function message(id: string, conversationId: string, senderId: string) {
  return {
    id,
    conversationId,
    senderId,
    type: "TEXT" as const,
    content: "Salut",
    status: "DELIVERED" as const,
    createdAt: "2026-10-24T10:00:00.000Z",
    updatedAt: "2026-10-24T10:00:00.000Z",
  };
}

describe("delivery receipts on reconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tells each sender, once per conversation, which messages were delivered", async () => {
    mockedPending.mockResolvedValue([
      message("m1", "conv-a", "alice"),
      message("m2", "conv-a", "alice"),
      message("m3", "conv-b", "bob"),
    ] as never);

    await deliverPendingMessages("me");

    expect(mockedPending).toHaveBeenCalledWith("me");
    expect(mockedEmit).toHaveBeenCalledTimes(2);
    expect(mockedEmit).toHaveBeenCalledWith(
      { conversationId: "conv-a", messages: [expect.objectContaining({ id: "m1" }), expect.objectContaining({ id: "m2" })] },
      ["alice"],
    );
    expect(mockedEmit).toHaveBeenCalledWith(
      { conversationId: "conv-b", messages: [expect.objectContaining({ id: "m3" })] },
      ["bob"],
    );
  });

  it("emits nothing when no message was waiting", async () => {
    mockedPending.mockResolvedValue([]);

    await deliverPendingMessages("me");

    expect(mockedEmit).not.toHaveBeenCalled();
  });
});
