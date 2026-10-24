import { systemNoticeText } from "./systemNotice";

describe("systemNoticeText", () => {
  it("tells the followee who followed them", () => {
    expect(systemNoticeText({ senderId: "ana" }, "ben", "Ana")).toBe("Ana started following you");
  });

  it("tells the follower what they did", () => {
    expect(systemNoticeText({ senderId: "ana" }, "ana", "Ben")).toBe("You followed Ben");
  });

  it("falls back to a neutral name", () => {
    expect(systemNoticeText({ senderId: "ana" }, "ben", " ")).toBe(
      "Your partner started following you",
    );
  });
});
