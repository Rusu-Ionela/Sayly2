import { passwordFormState } from "./changePassword";

describe("change password form", () => {
  it("shows nothing before the user types", () => {
    expect(passwordFormState({ current: "", next: "", confirm: "" })).toEqual({
      nextError: undefined,
      confirmError: undefined,
      matches: false,
      canSubmit: false,
    });
  });

  it("explains a weak new password", () => {
    expect(passwordFormState({ current: "a", next: "short", confirm: "" }).nextError).toBe(
      "Use 8 characters with an uppercase letter, a number, and a symbol.",
    );
  });

  it("says the passwords do not match while confirming", () => {
    const state = passwordFormState({ current: "old", next: "Newpass123!", confirm: "Newpass12!" });
    expect(state.confirmError).toBe("Passwords do not match");
    expect(state.canSubmit).toBe(false);
  });

  it("allows saving once everything is valid and matching", () => {
    const state = passwordFormState({
      current: "old",
      next: "Newpass123!",
      confirm: "Newpass123!",
    });
    expect(state).toMatchObject({ confirmError: undefined, matches: true, canSubmit: true });
  });

  it("needs the current password", () => {
    expect(
      passwordFormState({ current: "", next: "Newpass123!", confirm: "Newpass123!" }).canSubmit,
    ).toBe(false);
  });
});
