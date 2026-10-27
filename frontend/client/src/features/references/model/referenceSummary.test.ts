import { ApiError } from "@/lib/api/errors";

import { describeReferences, referenceErrorMessage } from "./referenceSummary";

describe("describeReferences", () => {
  it("says so when there are none", () => {
    expect(describeReferences(undefined)).toBe("No references yet");
    expect(describeReferences({ total: 0, positive: 0 })).toBe("No references yet");
  });

  it("counts references and positive ones", () => {
    expect(describeReferences({ total: 1, positive: 1 })).toBe("1 reference · 1 positive");
    expect(describeReferences({ total: 12, positive: 11 })).toBe("12 references · 11 positive");
  });
});

describe("referenceErrorMessage", () => {
  const fallback = "Could not save. Please try again.";

  it("shows the server's reason for a refused save", () => {
    const refused = new ApiError({
      status: 403,
      code: "FORBIDDEN",
      message: "Chat with this person first. Both of you need to have sent a message.",
    });
    expect(referenceErrorMessage(refused, fallback)).toBe(refused.message);
  });

  it("falls back for network, rate-limit and server errors", () => {
    expect(referenceErrorMessage(new TypeError("Network request failed"), fallback)).toBe(fallback);
    expect(
      referenceErrorMessage(
        new ApiError({ status: 429, code: "RATE_LIMITED", message: "Too many requests" }),
        fallback,
      ),
    ).toBe(fallback);
    expect(
      referenceErrorMessage(
        new ApiError({ status: 500, code: "INTERNAL_ERROR", message: "boom" }),
        fallback,
      ),
    ).toBe(fallback);
  });
});
