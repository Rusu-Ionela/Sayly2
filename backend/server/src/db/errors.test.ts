import { describe, expect, it } from "vitest";

import { dbFailureToAppError } from "./errors";

const pg = (code: string) => Object.assign(new Error("db"), { code });

describe("dbFailureToAppError", () => {
  it("turns a foreign-key violation into a 409", () => {
    expect(dbFailureToAppError(pg("23503"))).toMatchObject({ statusCode: 409, code: "CONFLICT" });
  });

  it.each(["40P01", "40001", "57014"])("turns transient %s into a retryable 503", (code) => {
    expect(dbFailureToAppError(pg(code))).toMatchObject({
      statusCode: 503,
      code: "SERVICE_UNAVAILABLE",
      retryAfterSeconds: 1,
    });
  });

  it("finds the code on a wrapped driver error", () => {
    expect(dbFailureToAppError(new Error("Failed query", { cause: pg("40P01") }))?.statusCode).toBe(503);
  });

  it("leaves unknown errors alone", () => {
    expect(dbFailureToAppError(new Error("boom"))).toBeUndefined();
    expect(dbFailureToAppError(pg("23505"))).toBeUndefined();
  });
});
