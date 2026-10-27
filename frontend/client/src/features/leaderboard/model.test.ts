import { podiumOrder, splitPodium, timeLeftLabel } from "./model";

describe("leaderboard model", () => {
  it("puts the top three on the podium as 2nd, 1st, 3rd", () => {
    const { podium, rest } = splitPodium(["a", "b", "c", "d", "e"] as never[]);
    expect(podium).toEqual(["a", "b", "c"]);
    expect(rest).toEqual(["d", "e"]);
    expect(podiumOrder(podium)).toEqual(["b", "a", "c"]);
  });

  it("keeps a short podium centred on first place", () => {
    expect(podiumOrder(["a"])).toEqual(["a"]);
    expect(podiumOrder(["a", "b"])).toEqual(["b", "a"]);
  });

  it("counts down to the end of the week", () => {
    const end = "2026-11-02T00:00:00.000Z";
    expect(timeLeftLabel(end, new Date("2026-10-28T00:00:00Z"))).toBe("5 zile");
    expect(timeLeftLabel(end, new Date("2026-11-01T00:00:00Z"))).toBe("1 zi");
    expect(timeLeftLabel(end, new Date("2026-11-01T19:30:00Z"))).toBe("5 ore");
    expect(timeLeftLabel(end, new Date("2026-11-01T23:30:00Z"))).toBe("1 oră");
  });
});
