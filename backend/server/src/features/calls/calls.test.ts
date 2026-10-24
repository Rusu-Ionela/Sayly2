import { createHmac } from "crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "../../config/env";
import { AppError } from "../../shared/errors/AppError";

vi.mock("../messaging/service", () => ({ assertCanAccessConversation: vi.fn() }));
vi.mock("../messaging/presence", () => ({ isOnline: vi.fn() }));

import { isOnline } from "../messaging/presence";
import { assertCanAccessConversation } from "../messaging/service";
import { callSignalSchema } from "./schema";
import {
  acceptCall,
  currentCallId,
  endCall,
  iceServers,
  otherParty,
  startCall,
} from "./service";

const mockedAccess = vi.mocked(assertCanAccessConversation);
const mockedOnline = vi.mocked(isOnline);

// The in-memory Redis is shared across tests, so every test gets fresh user ids.
let n = 0;
let caller = "";
let callee = "";

beforeEach(() => {
  n += 1;
  caller = `caller-${n}`;
  callee = `callee-${n}`;
  vi.clearAllMocks();
  mockedOnline.mockResolvedValue(true);
  mockedAccess.mockImplementation(async (conversationId: string) => ({
    conversationId,
    otherUserId: callee,
  }));
});

const invite = (kind: "AUDIO" | "VIDEO" = "VIDEO", from = caller) =>
  startCall({ callerId: from, conversationId: "conv-1", kind });

async function expectCode(promise: Promise<unknown>, code: string, status: number) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ code, statusCode: status });
}

describe("startCall", () => {
  it("rings the other person in the conversation", async () => {
    const call = await invite("AUDIO");
    expect(call).toMatchObject({
      callerId: caller,
      calleeId: callee,
      conversationId: "conv-1",
      kind: "AUDIO",
      status: "RINGING",
    });
    expect(await currentCallId(caller)).toBe(call.callId);
    expect(await currentCallId(callee)).toBe(call.callId);
  });

  it("refuses when the callee is offline, and leaves nobody busy", async () => {
    mockedOnline.mockResolvedValue(false);
    await expectCode(invite(), "CALLEE_OFFLINE", 409);
    expect(await currentCallId(caller)).toBeNull();
  });

  it("propagates an access failure (blocked, not a member, inactive)", async () => {
    mockedAccess.mockRejectedValueOnce(new AppError("Conversation not found", 404, "NOT_FOUND"));
    await expectCode(invite(), "NOT_FOUND", 404);
    expect(await currentCallId(caller)).toBeNull();
  });

  it("refuses a second call while the caller is already ringing or talking", async () => {
    await invite();
    await expectCode(invite(), "CALL_BUSY", 409);
  });

  it("refuses when the callee is on another call, and frees the caller again", async () => {
    const other = `other-${n}`;
    await invite("VIDEO", other); // other -> callee, so callee is now busy
    await expectCode(invite(), "CALL_BUSY", 409);
    expect(await currentCallId(caller)).toBeNull();
  });
});

describe("acceptCall", () => {
  it("lets the callee answer and marks the call active", async () => {
    const call = await invite();
    await expect(acceptCall(call.callId, callee)).resolves.toMatchObject({ status: "ACTIVE" });
  });

  it("does not let the caller answer their own call", async () => {
    const call = await invite();
    await expectCode(acceptCall(call.callId, caller), "FORBIDDEN", 403);
  });

  it("hides the call from anyone who is not a participant", async () => {
    const call = await invite();
    await expectCode(acceptCall(call.callId, "stranger"), "NOT_FOUND", 404);
  });

  it("rejects answering twice", async () => {
    const call = await invite();
    await acceptCall(call.callId, callee);
    await expectCode(acceptCall(call.callId, callee), "CONFLICT", 409);
  });

  it("404s for an unknown call id", async () => {
    await expectCode(acceptCall("nope", callee), "NOT_FOUND", 404);
  });
});

describe("endCall", () => {
  it("reports 'cancelled' when the caller hangs up while ringing", async () => {
    const call = await invite();
    const { reason, record } = await endCall(call.callId, caller);
    expect(reason).toBe("cancelled");
    expect(otherParty(record, caller)).toBe(callee);
  });

  it("reports 'declined' when the callee refuses", async () => {
    const call = await invite();
    expect((await endCall(call.callId, callee)).reason).toBe("declined");
  });

  it("reports 'ended' for an answered call, from either side", async () => {
    const call = await invite();
    await acceptCall(call.callId, callee);
    expect((await endCall(call.callId, callee)).reason).toBe("ended");
  });

  it("uses the forced reason (disconnects)", async () => {
    const call = await invite();
    await acceptCall(call.callId, callee);
    expect((await endCall(call.callId, caller, "disconnected")).reason).toBe("disconnected");
  });

  it("frees both people so they can call again", async () => {
    const call = await invite();
    await endCall(call.callId, caller);
    expect(await currentCallId(caller)).toBeNull();
    expect(await currentCallId(callee)).toBeNull();
    await expect(invite()).resolves.toMatchObject({ status: "RINGING" });
  });

  it("is a 404 the second time, and for strangers", async () => {
    const call = await invite();
    await expectCode(endCall(call.callId, "stranger"), "NOT_FOUND", 404);
    await endCall(call.callId, caller);
    await expectCode(endCall(call.callId, caller), "NOT_FOUND", 404);
  });
});

describe("iceServers", () => {
  const original = { turnUrls: env.turnUrls, turnSharedSecret: env.turnSharedSecret };
  const mutableEnv = env as { turnUrls: string[]; turnSharedSecret: string };

  beforeEach(() => {
    mutableEnv.turnUrls = original.turnUrls;
    mutableEnv.turnSharedSecret = original.turnSharedSecret;
  });

  it("returns STUN only when no TURN server is configured", () => {
    mutableEnv.turnUrls = [];
    mutableEnv.turnSharedSecret = "";
    const servers = iceServers("user-1");
    expect(servers).toHaveLength(1);
    expect(servers[0]?.username).toBeUndefined();
    expect(servers[0]?.urls.length).toBeGreaterThan(0);
  });

  it("adds TURN with time-limited credentials derived from the shared secret", () => {
    mutableEnv.turnUrls = ["turn:turn.example.com:3478"];
    mutableEnv.turnSharedSecret = "s3cret";
    const now = Date.UTC(2026, 9, 18);
    const turn = iceServers("user-1", now)[1];

    const expiresAt = Math.floor(now / 1000) + env.turnCredentialTtlSeconds;
    expect(turn?.username).toBe(`${expiresAt}:user-1`);
    expect(turn?.credential).toBe(
      createHmac("sha1", "s3cret").update(`${expiresAt}:user-1`).digest("base64"),
    );
    expect(turn?.urls).toEqual(["turn:turn.example.com:3478"]);
  });
});

describe("callSignalSchema", () => {
  it("accepts a normal signal and rejects an oversized one", () => {
    expect(callSignalSchema.safeParse({ callId: "c1", data: { type: "offer", sdp: "v=0" } }).success).toBe(true);
    expect(
      callSignalSchema.safeParse({ callId: "c1", data: { sdp: "x".repeat(25_000) } }).success,
    ).toBe(false);
  });
});
