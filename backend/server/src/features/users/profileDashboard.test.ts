import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"));
vi.mock("./service", () => ({
  findBySaylyId: vi.fn(async () => ({ userId: "user-2" })),
  exportMyData: vi.fn(async () => ({ exportedAt: "2026-10-21T00:00:00.000Z" })),
}));

import { createApp } from "../../lib/app";
import { generateSaylyId, SAYLY_ID_PATTERN } from "../../shared/utils/saylyId";
import { TEST_VIEWER_ID } from "../../test/authMock";
import { findExpression, listExpressions } from "../messaging/expressions";
import { updateSettingsSchema } from "./schema";
import * as usersService from "./service";

const service = vi.mocked(usersService);
const app = createApp();
const auth = { Authorization: "Bearer test" };

describe("Sayly ID", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates readable codes without look-alike characters", () => {
    for (let i = 0; i < 200; i += 1) {
      const id = generateSaylyId();
      expect(id).toMatch(SAYLY_ID_PATTERN);
      expect(id).not.toMatch(/[01OIL]/);
    }
  });

  it("resolves a shared code case-insensitively", async () => {
    const res = await request(app).get("/users/by-sayly-id/k7qf3mza").set(auth).expect(200);
    expect(res.body).toEqual({ userId: "user-2" });
    expect(service.findBySaylyId).toHaveBeenCalledWith(TEST_VIEWER_ID, "K7QF3MZA");
  });

  it("answers malformed codes with 404 without a lookup", async () => {
    await request(app).get("/users/by-sayly-id/NOPE").set(auth).expect(404);
    await request(app).get("/users/by-sayly-id/K7QF3MZ0").set(auth).expect(404);
    expect(service.findBySaylyId).not.toHaveBeenCalled();
  });
});

describe("Download my data", () => {
  it("exports only the signed-in member's data and is never cached", async () => {
    const res = await request(app).get("/users/me/export").set(auth).expect(200);
    expect(service.exportMyData).toHaveBeenCalledWith(TEST_VIEWER_ID);
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});

describe("settings: translate to", () => {
  it("normalises language codes and allows clearing", () => {
    expect(updateSettingsSchema.parse({ translateTo: "ES" }).translateTo).toBe("es");
    expect(updateSettingsSchema.parse({ translateTo: null }).translateTo).toBeNull();
    expect(() => updateSettingsSchema.parse({ translateTo: "klingon" })).toThrow();
  });

  it("accepts the new privacy toggles", () => {
    expect(updateSettingsSchema.parse({ showSaylyId: false, showCertificates: false })).toEqual({
      showSaylyId: false,
      showCertificates: false,
    });
  });
});

describe("expressions catalog", () => {
  it("has unique, stable ids and filters by language", () => {
    const all = listExpressions(["en", "es", "fr", "de", "it"]);
    expect(new Set(all.map((item) => item.id)).size).toBe(all.length);
    expect(listExpressions(["es"]).every((item) => item.languageCode === "es")).toBe(true);
    expect(findExpression("en-spill-the-beans")?.phrase).toBe("Spill the beans");
    expect(findExpression("nope")).toBeUndefined();
  });
});
