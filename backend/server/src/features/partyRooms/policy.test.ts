import { describe, expect, it } from "vitest";
import { PARTY_MAX_PARTICIPANTS, PARTY_MAX_SPEAKERS, type PartyRole } from "@sayly/shared";

import {
  assertCanDeclineHand,
  assertCanDemote,
  assertCanMuteOther,
  assertCanPromote,
  assertCanRaiseHand,
  assertCanRemove,
  assertCanSignal,
  nextHost,
  roleOnJoin,
  type PartyMember,
} from "./policy";

let clock = 0;
function member(userId: string, role: PartyRole, joinedOffset = clock++): PartyMember {
  return { userId, role, handRaisedAt: null, joinedAt: new Date(1_000_000 + joinedOffset * 1000) };
}

const room = { status: "LIVE", hostId: "host" };

describe("joining", () => {
  it("gives the host their seat back and everyone else a listener seat", () => {
    expect(roleOnJoin(room, "host", PARTY_MAX_PARTICIPANTS)).toBe("HOST");
    expect(roleOnJoin(room, "guest", 3)).toBe("LISTENER");
  });

  it("refuses listeners once the room is full", () => {
    expect(() => roleOnJoin(room, "guest", PARTY_MAX_PARTICIPANTS)).toThrow(/full/);
  });
});

describe("stage controls", () => {
  const host = member("host", "HOST");
  const speaker = member("spk", "SPEAKER");
  const listener = member("lst", "LISTENER");
  const members = [host, speaker, listener];

  it("lets only listeners raise a hand", () => {
    expect(() => assertCanRaiseHand(listener)).not.toThrow();
    expect(() => assertCanRaiseHand(speaker)).toThrow();
  });

  it("lets the host bring a listener on stage", () => {
    expect(assertCanPromote(host, members, "lst").userId).toBe("lst");
    expect(() => assertCanPromote(speaker, members, "lst")).toThrow(/host/);
    expect(() => assertCanPromote(host, members, "spk")).toThrow(/already/);
  });

  it("caps the number of speakers", () => {
    const full = [host, ...Array.from({ length: PARTY_MAX_SPEAKERS - 1 }, (_, i) => member(`s${i}`, "SPEAKER")), listener];
    expect(() => assertCanPromote(host, full, "lst")).toThrow(/at most/);
  });

  it("lets only the host decline a raised hand", () => {
    const raised = { ...listener, handRaisedAt: new Date() };
    const withHand = [host, speaker, raised];
    expect(assertCanDeclineHand(host, withHand, "lst").userId).toBe("lst");
    expect(() => assertCanDeclineHand(speaker, withHand, "lst")).toThrow(/host/);
    expect(() => assertCanDeclineHand(host, members, "lst")).toThrow(/not raised/);
    expect(() => assertCanDeclineHand(host, withHand, "spk")).toThrow(/not raised/);
    expect(() => assertCanDeclineHand(host, withHand, "ghost")).toThrow(/no longer/);
  });

  it("lets the host or the speaker themselves step down, never the host", () => {
    expect(() => assertCanDemote(host, members, "spk")).not.toThrow();
    expect(() => assertCanDemote(speaker, members, "spk")).not.toThrow();
    expect(() => assertCanDemote(listener, [...members, member("spk2", "SPEAKER")], "spk2")).toThrow(/host/);
    expect(() => assertCanDemote(host, members, "host")).toThrow(/host stays/);
  });

  it("lets the host remove others but not themselves", () => {
    expect(() => assertCanRemove(host, members, "lst")).not.toThrow();
    expect(() => assertCanRemove(host, members, "host")).toThrow();
    expect(() => assertCanRemove(speaker, members, "lst")).toThrow();
  });

  it("only mutes people who have a microphone", () => {
    expect(() => assertCanMuteOther(host, members, "spk")).not.toThrow();
    expect(() => assertCanMuteOther(host, members, "lst")).toThrow();
  });
});

describe("audio links", () => {
  const members = [member("host", "HOST"), member("spk", "SPEAKER"), member("a", "LISTENER"), member("b", "LISTENER")];

  it("connects any pair with at least one speaker", () => {
    expect(() => assertCanSignal(members, "a", "host")).not.toThrow();
    expect(() => assertCanSignal(members, "spk", "b")).not.toThrow();
    expect(() => assertCanSignal(members, "host", "spk")).not.toThrow();
  });

  it("never links two listeners or strangers", () => {
    expect(() => assertCanSignal(members, "a", "b")).toThrow();
    expect(() => assertCanSignal(members, "a", "ghost")).toThrow();
    expect(() => assertCanSignal(members, "ghost", "host")).toThrow();
  });
});

describe("host handover", () => {
  it("picks the longest-standing speaker", () => {
    const members = [member("host", "HOST", 0), member("late", "SPEAKER", 9), member("early", "SPEAKER", 5), member("l", "LISTENER", 1)];
    expect(nextHost(members, "host")?.userId).toBe("early");
  });

  it("returns null without speakers, so the room ends", () => {
    expect(nextHost([member("host", "HOST"), member("l", "LISTENER")], "host")).toBeNull();
  });
});
