import { rootLinking } from "./linking";

describe("rootLinking", () => {
  it("maps shared Sayly IDs to the resolver screen", () => {
    const app = rootLinking.config?.screens?.App;
    const screens = typeof app === "object" && "screens" in app ? app.screens : undefined;

    expect(screens?.SharedProfile).toBe("u/:saylyId");
  });
});
