import { describe, expect, it } from "vitest";

import { ageFromDateOfBirth, currentAge } from "./age";

describe("currentAge", () => {
  it("is computed from the date of birth, not the stored value", () => {
    const dob = new Date("2000-01-01T00:00:00.000Z");
    expect(currentAge({ dateOfBirth: dob, age: 1 })).toBe(ageFromDateOfBirth(dob));
  });

  it("falls back to the stored age when there is no date of birth", () => {
    expect(currentAge({ dateOfBirth: null, age: 31 })).toBe(31);
    expect(currentAge({ dateOfBirth: null, age: null })).toBeNull();
  });
});
