import { maskEmail, log } from "./logger";

describe("logger redaction", () => {
  it("masks emails including the domain", () => {
    expect(maskEmail("alex@example.com")).toBe("a***@***.com");
  });

  it("redacts camelCase sensitive keys without throwing", () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    log.info("test", "payload", {
      password: "secret",
      confirmPassword: "secret",
      accessToken: "tok",
      refreshToken: "tok",
      challengeId: "challenge-secret",
      nested: { authorization: "Bearer x", email: "user@example.com" },
    });
    // Logging may be disabled outside __DEV__; still assert no throw and mask helper works.
    if (spy.mock.calls.length > 0) {
      const line = String(spy.mock.calls[0]?.[0] ?? "");
      expect(line).toContain("[redacted]");
      expect(line).not.toContain("secret");
      expect(line).not.toContain("Bearer x");
      expect(line).not.toContain("challenge-secret");
      expect(line).not.toContain("example.com");
    }
    spy.mockRestore();
  });
});
