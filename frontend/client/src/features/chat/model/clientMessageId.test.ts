import { createClientMessageId, isLocalMessageId, resolveClientMessageId } from "./clientMessageId";

describe("clientMessageId", () => {
  it("creates stable-looking ids", () => {
    const a = createClientMessageId();
    const b = createClientMessageId();
    expect(a).toMatch(/^msg-/);
    expect(b).toMatch(/^msg-/);
    expect(a).not.toBe(b);
  });

  it("detects local / client ids", () => {
    expect(isLocalMessageId("msg-abc")).toBe(true);
    expect(isLocalMessageId("local-1")).toBe(true);
    expect(isLocalMessageId("cuid123")).toBe(false);
  });

  it("socket→HTTP fallback preserves the same clientMessageId", () => {
    const clientMessageId = createClientMessageId();
    const socketBody = { clientMessageId, content: "hola" };
    // Fallback path must reuse the identical id, never mint a second one.
    const httpBody = {
      clientMessageId: resolveClientMessageId(socketBody.clientMessageId),
      content: "hola",
    };
    expect(httpBody.clientMessageId).toBe(socketBody.clientMessageId);
  });

  it("retry preserves the original clientMessageId", () => {
    const original = createClientMessageId();
    const failedOptimistic = {
      id: original,
      clientMessageId: original,
    };
    const retryId = resolveClientMessageId(failedOptimistic.clientMessageId ?? failedOptimistic.id);
    expect(retryId).toBe(original);
    expect(retryId).not.toBe(createClientMessageId());
  });
});
