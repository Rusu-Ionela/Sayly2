import { needsManualReconnect, RECONNECT_MAX_MS, reconnectDelayMs } from "./reconnectPolicy";

describe("socket reconnect policy", () => {
  const middle = () => 0.5; // no jitter

  it("backs off exponentially from 1s", () => {
    expect([0, 1, 2, 3, 4].map((attempt) => reconnectDelayMs(attempt, middle))).toEqual([
      1_000, 2_000, 4_000, 8_000, 16_000,
    ]);
  });

  it("never waits longer than 30s", () => {
    expect(reconnectDelayMs(10, middle)).toBe(RECONNECT_MAX_MS);
    expect(reconnectDelayMs(10, () => 0.99)).toBe(RECONNECT_MAX_MS);
  });

  it("adds ±50% jitter", () => {
    expect(reconnectDelayMs(2, () => 0)).toBe(2_000);
    expect(reconnectDelayMs(2, () => 1)).toBe(6_000);
  });

  it("retries manually only when the server closed the socket", () => {
    expect(needsManualReconnect("io server disconnect")).toBe(true);
    expect(needsManualReconnect("transport close")).toBe(false);
    expect(needsManualReconnect("ping timeout")).toBe(false);
    expect(needsManualReconnect("io client disconnect")).toBe(false);
  });
});
