import type { PartyParticipantDto, PartyRole, PartyRoomDto } from "@sayly/shared";

import {
  MAX_FLOATING_REACTIONS,
  REACTION_LIFETIME_MS,
  addReaction,
  planPeers,
  raisedHands,
} from "./partyModel";

function person(
  id: string,
  role: PartyRole,
  handRaisedAt: string | null = null,
): PartyParticipantDto {
  return {
    id,
    displayName: id,
    avatarUrl: null,
    role,
    muted: true,
    handRaisedAt,
    joinedAt: "2026-10-27T10:00:00.000Z",
  };
}

function room(participants: PartyParticipantDto[]): PartyRoomDto {
  return {
    id: "r1",
    title: "Room",
    languageId: "es",
    languageName: "Spanish",
    flagEmoji: null,
    groupId: null,
    status: "LIVE",
    hostId: "h",
    speakers: participants.filter((item) => item.role !== "LISTENER"),
    listeners: participants.filter((item) => item.role === "LISTENER"),
    maxSpeakers: 6,
    maxParticipants: 40,
    createdAt: "2026-10-27T10:00:00.000Z",
  };
}

describe("planPeers", () => {
  const state = room([
    person("h", "HOST"),
    person("s", "SPEAKER"),
    person("a", "LISTENER"),
    person("b", "LISTENER"),
  ]);

  it("links a listener only to speakers, receiving", () => {
    const plans = planPeers("a", state);
    expect([...plans.keys()].sort()).toEqual(["h", "s"]);
    expect(plans.get("h")).toMatchObject({ iSend: false, theySend: true, iOffer: false });
  });

  it("makes a speaker send to everyone and offer to listeners", () => {
    const plans = planPeers("s", state);
    expect([...plans.keys()].sort()).toEqual(["a", "b", "h"]);
    expect(plans.get("a")).toMatchObject({ iSend: true, theySend: false, iOffer: true });
  });

  it("agrees on one offerer and one key between two speakers", () => {
    const fromHost = planPeers("h", state).get("s")!;
    const fromSpeaker = planPeers("s", state).get("h")!;
    expect(fromHost.key).toBe(fromSpeaker.key);
    expect(fromHost.iOffer).not.toBe(fromSpeaker.iOffer);
  });

  it("changes the key when a listener is promoted, so the link is rebuilt", () => {
    const before = planPeers("h", state).get("a")!.key;
    const promoted = room([
      person("h", "HOST"),
      person("s", "SPEAKER"),
      person("a", "SPEAKER"),
      person("b", "LISTENER"),
    ]);
    expect(planPeers("h", promoted).get("a")!.key).not.toBe(before);
  });

  it("returns nothing for someone not in the room", () => {
    expect(planPeers("ghost", state).size).toBe(0);
  });
});

describe("reactions", () => {
  it("ignores duplicates and drops expired ones", () => {
    let list = addReaction([], { id: "x", kind: "FIRE" }, 0);
    list = addReaction(list, { id: "x", kind: "FIRE" }, 10);
    expect(list).toHaveLength(1);
    list = addReaction(list, { id: "y", kind: "HEART" }, REACTION_LIFETIME_MS + 1);
    expect(list.map((item) => item.id)).toEqual(["y"]);
  });

  it("caps a burst", () => {
    let list = addReaction([], { id: "0", kind: "CLAP" }, 0);
    for (let index = 1; index < 40; index += 1)
      list = addReaction(list, { id: String(index), kind: "CLAP" }, 1);
    expect(list).toHaveLength(MAX_FLOATING_REACTIONS);
  });
});

describe("raisedHands", () => {
  it("lists listeners with a raised hand", () => {
    const state = room([
      person("h", "HOST"),
      person("a", "LISTENER", "2026-10-27T10:01:00.000Z"),
      person("b", "LISTENER"),
    ]);
    expect(raisedHands(state).map((item) => item.id)).toEqual(["a"]);
  });
});
