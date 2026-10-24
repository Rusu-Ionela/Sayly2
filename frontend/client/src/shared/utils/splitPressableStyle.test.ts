import { splitPressableStyle } from "./splitPressableStyle";

describe("splitPressableStyle", () => {
  it("moves child layout to content and keeps sizing/decoration on the shell", () => {
    const { shell, content } = splitPressableStyle({
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderRadius: 20,
      minHeight: 54,
    });
    expect(content).toEqual({ flexDirection: "row", alignItems: "center", gap: 12 });
    expect(shell).toEqual({ padding: 16, borderRadius: 20, minHeight: 54 });
  });

  it("handles a missing style", () => {
    expect(splitPressableStyle(undefined)).toEqual({ shell: {}, content: {} });
  });
});
