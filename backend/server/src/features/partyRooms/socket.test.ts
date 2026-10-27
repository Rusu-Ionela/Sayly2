import { beforeEach, describe, expect, it, vi } from "vitest";
import { PARTY_EVENTS } from "@sayly/shared";

import { AppError } from "../../shared/errors/AppError";

const emitted: { target: string; event: string; payload: unknown }[] = [];
const fakeIo = {
  to: (target: string) => ({
    emit: (event: string, payload: unknown) => emitted.push({ target, event, payload }),
  }),
  in: () => ({ socketsLeave: vi.fn() }),
};

vi.mock("../messaging/gateway", () => ({ getMessagingIo: () => fakeIo }));
vi.mock("../messaging/socket", () => ({
  ackOk: (ack: ((p: unknown) => void) | undefined, extra: Record<string, unknown> = {}) => ack?.({ ok: true, ...extra }),
  assertLiveSession: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../infra/limiter/limiter", () => ({
  consumeLimit: vi.fn().mockResolvedValue(undefined),
  rateLimitPolicies: { partyAction: {}, partyReaction: {}, partySignal: {}, groupCreate: {} },
}));
vi.mock("./service", () => ({ createRoom: vi.fn(), prepareJoin: vi.fn() }));
vi.mock("./repository", () => ({
  declineHand: vi.fn(),
  liveMembers: vi.fn(),
  loadRoomDto: vi.fn(),
}));

import { consumeLimit } from "../../infra/limiter/limiter";
import * as repository from "./repository";
import { createRoom } from "./service";
import { registerPartyRoomSockets } from "./socket";

type Handler = (payload: unknown, ack?: (reply: Record<string, unknown>) => void) => Promise<void>;

function connect(userId = "host") {
  const handlers = new Map<string, Handler>();
  const socket = {
    id: `sock-${userId}`,
    data: { userId },
    on: (event: string, handler: Handler) => handlers.set(event, handler),
  };
  registerPartyRoomSockets(socket as never);
  return async (event: string, payload: unknown) => {
    const ack = vi.fn();
    await handlers.get(event)!(payload, ack);
    return ack.mock.calls[0]?.[0] as Record<string, unknown>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  emitted.length = 0;
});

describe("party_create", () => {
  it("creates the room and acks its id", async () => {
    vi.mocked(createRoom).mockResolvedValue({ id: "r1" });
    const send = connect();
    const reply = await send(PARTY_EVENTS.create, { title: "Coffee chat", languageId: "es" });
    expect(reply).toEqual({ ok: true, id: "r1" });
    expect(createRoom).toHaveBeenCalledWith("host", { title: "Coffee chat", languageId: "es" });
    expect(consumeLimit).toHaveBeenCalled();
  });

  it("answers a bad payload with a validation error", async () => {
    const send = connect();
    const reply = await send(PARTY_EVENTS.create, { title: "x", languageId: "es" });
    expect(reply).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(createRoom).not.toHaveBeenCalled();
  });

  it("passes on service errors", async () => {
    vi.mocked(createRoom).mockRejectedValue(new AppError("You are already hosting a live room", 409, "CONFLICT"));
    const send = connect();
    const reply = await send(PARTY_EVENTS.create, { title: "Coffee chat", languageId: "es" });
    expect(reply).toMatchObject({ ok: false, code: "CONFLICT", error: "You are already hosting a live room" });
  });
});

describe("party_decline_hand", () => {
  it("lowers the hand, tells the listener and rebroadcasts the room", async () => {
    vi.mocked(repository.declineHand).mockResolvedValue({
      roomId: "r1",
      ended: null,
      evictSocketIds: [],
      removedSocketIds: [],
      forceMuteSocketId: null,
      handDeclinedSocketId: "sock-listener",
    });
    vi.mocked(repository.loadRoomDto).mockResolvedValue({ id: "r1" } as never);
    const send = connect();
    const reply = await send(PARTY_EVENTS.declineHand, { roomId: "r1", userId: "listener" });

    expect(reply).toEqual({ ok: true });
    expect(repository.declineHand).toHaveBeenCalledWith("r1", "host", "listener");
    expect(emitted).toContainEqual({ target: "sock-listener", event: PARTY_EVENTS.handDeclined, payload: { roomId: "r1" } });
    expect(emitted).toContainEqual({ target: "party:r1", event: PARTY_EVENTS.state, payload: { id: "r1" } });
  });

  it("reports a refusal from the rules", async () => {
    vi.mocked(repository.declineHand).mockRejectedValue(new AppError("Only the host can do this", 403, "FORBIDDEN"));
    const send = connect("guest");
    const reply = await send(PARTY_EVENTS.declineHand, { roomId: "r1", userId: "listener" });
    expect(reply).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(emitted).toEqual([]);
  });
});

describe("party_react", () => {
  it("broadcasts a reaction from a member on this device", async () => {
    vi.mocked(repository.liveMembers).mockResolvedValue({
      members: [],
      rows: [{ userId: "host", socketId: "sock-host" }] as never,
    });
    const send = connect();
    const reply = await send(PARTY_EVENTS.react, { roomId: "r1", kind: "FIRE" });
    expect(reply).toEqual({ ok: true });
    expect(emitted[0]).toMatchObject({
      target: "party:r1",
      event: PARTY_EVENTS.reaction,
      payload: { roomId: "r1", userId: "host", kind: "FIRE" },
    });
  });

  it("ignores a member joined from another device", async () => {
    vi.mocked(repository.liveMembers).mockResolvedValue({
      members: [],
      rows: [{ userId: "host", socketId: "other-socket" }] as never,
    });
    const send = connect();
    const reply = await send(PARTY_EVENTS.react, { roomId: "r1", kind: "HEART" });
    expect(reply).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(emitted).toEqual([]);
  });
});
