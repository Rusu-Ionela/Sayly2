import { callReducer, idleCall, type CallState } from "./callState";

const peer = { id: "u2", displayName: "Maria", avatarUrl: null };
const ring = { callId: "c1", conversationId: "conv1", kind: "VIDEO" as const, peer };

const outgoing = () => callReducer(idleCall, { type: "outgoing", ...ring });
const incoming = () => callReducer(idleCall, { type: "incoming", ...ring });
const active = (): CallState => {
  const connecting = callReducer(outgoing(), { type: "connecting" });
  return callReducer(connecting, { type: "connected", at: 1000 });
};

describe("callReducer", () => {
  it("starts an outgoing or incoming call from idle", () => {
    expect(outgoing()).toMatchObject({ phase: "outgoing", callId: "c1", kind: "VIDEO", peer });
    expect(incoming()).toMatchObject({ phase: "incoming", callId: "c1" });
  });

  it("ignores a new ring while already in a call", () => {
    const busy = outgoing();
    expect(callReducer(busy, { type: "incoming", ...ring, callId: "c2" })).toBe(busy);
    expect(callReducer(busy, { type: "outgoing", ...ring, callId: "c3" })).toBe(busy);
  });

  it("moves ringing -> connecting -> active, recording when media connected", () => {
    const connecting = callReducer(incoming(), { type: "connecting" });
    expect(connecting.phase).toBe("connecting");
    expect(callReducer(connecting, { type: "connected", at: 42 })).toMatchObject({
      phase: "active",
      connectedAt: 42,
    });
  });

  it("does not skip straight from ringing to active", () => {
    const ringing = outgoing();
    expect(callReducer(ringing, { type: "connected", at: 1 })).toBe(ringing);
  });

  it("returns to idle with a notice for the other side's reasons", () => {
    expect(callReducer(outgoing(), { type: "ended", reason: "declined", callId: "c1" })).toEqual({
      ...idleCall,
      notice: "Call declined",
    });
    expect(
      callReducer(active(), { type: "ended", reason: "disconnected", callId: "c1" }).notice,
    ).toBe("Call lost");
    expect(callReducer(active(), { type: "ended", reason: "ended", callId: "c1" }).notice).toBe(
      "Call ended",
    );
    expect(callReducer(active(), { type: "ended", reason: "failed" }).notice).toBe(
      "Couldn’t connect the call",
    );
  });

  it("reports a missed call only when it was ringing for us", () => {
    expect(
      callReducer(incoming(), { type: "ended", reason: "cancelled", callId: "c1" }).notice,
    ).toBe("Missed call");
    expect(callReducer(outgoing(), { type: "ended", reason: "cancelled" }).notice).toBeNull();
  });

  it("a local hang-up (no call id, unknown reason) leaves no notice", () => {
    expect(callReducer(active(), { type: "ended", reason: "local" })).toEqual(idleCall);
  });

  it("ignores an end event for a different call", () => {
    const current = active();
    expect(callReducer(current, { type: "ended", reason: "ended", callId: "other" })).toBe(current);
  });

  it("ignores an end event when idle", () => {
    expect(callReducer(idleCall, { type: "ended", reason: "ended", callId: "c1" })).toBe(idleCall);
  });

  it("toggles mute during a call but not when idle", () => {
    expect(callReducer(active(), { type: "toggleMute" }).muted).toBe(true);
    expect(callReducer(idleCall, { type: "toggleMute" })).toBe(idleCall);
  });

  it("toggles the camera only on video calls", () => {
    expect(callReducer(active(), { type: "toggleCamera" }).cameraOff).toBe(true);
    const audio = callReducer(idleCall, { type: "outgoing", ...ring, kind: "AUDIO" });
    expect(callReducer(audio, { type: "toggleCamera" })).toBe(audio);
  });

  it("starts the next call clean after one ended", () => {
    const ended = callReducer(active(), { type: "toggleMute" });
    const idle = callReducer(ended, { type: "ended", reason: "ended", callId: "c1" });
    expect(callReducer(idle, { type: "incoming", ...ring, callId: "c9" })).toMatchObject({
      phase: "incoming",
      muted: false,
      connectedAt: null,
      notice: null,
    });
  });

  it("clears the notice", () => {
    const ended = callReducer(outgoing(), { type: "ended", reason: "declined" });
    expect(callReducer(ended, { type: "clearNotice" }).notice).toBeNull();
  });
  it("starts video calls on the speaker and audio calls on the earpiece", () => {
    expect(outgoing().speakerOn).toBe(true);
    const audio = callReducer(idleCall, { type: "incoming", ...ring, kind: "AUDIO" });
    expect(audio.speakerOn).toBe(false);
    expect(callReducer(audio, { type: "toggleSpeaker" }).speakerOn).toBe(true);
    expect(callReducer(idleCall, { type: "toggleSpeaker" })).toBe(idleCall);
  });

  it("tells a second device the call was picked up elsewhere", () => {
    expect(
      callReducer(incoming(), { type: "ended", reason: "answered_elsewhere", callId: "c1" }).notice,
    ).toBe("Answered on another device");
  });
});
