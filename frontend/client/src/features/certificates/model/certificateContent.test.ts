import { discountPercent, formatPrice, recommendedTestLevel } from "./certificateContent";

describe("certificate offer helpers", () => {
  it("recommends the next level up", () => {
    expect(recommendedTestLevel(undefined)).toBe("A2");
    expect(recommendedTestLevel("BEGINNER")).toBe("A2");
    expect(recommendedTestLevel("INTERMEDIATE")).toBe("B1");
    expect(recommendedTestLevel("UPPER_INTERMEDIATE")).toBe("B2");
    expect(recommendedTestLevel("ADVANCED")).toBe("C1");
  });

  it("formats minor units and the promotion", () => {
    expect(formatPrice(266, "USD")).toMatch(/2[.,]66/);
    expect(discountPercent({ currency: "USD", amountMinor: 266, originalAmountMinor: 443 })).toBe(
      40,
    );
    expect(discountPercent({ currency: "USD", amountMinor: 500, originalAmountMinor: 500 })).toBe(
      0,
    );
  });
});
