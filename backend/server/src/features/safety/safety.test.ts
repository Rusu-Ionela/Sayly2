import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"));
vi.mock("./service", () => ({
  blockUser: vi.fn(),
  listBlocks: vi.fn(),
  unblockUser: vi.fn(),
  reportUser: vi.fn(),
  listReports: vi.fn(),
  reviewReport: vi.fn(),
}));

import { createApp } from "../../lib/app";
import * as safetyService from "./service";

const report = {
  id: "report-1",
  reporterId: "viewer-1",
  reportedId: "user-2",
  messageId: null,
  reason: "Harassment",
  details: "Unwanted messages",
  status: "PENDING" as const,
  reviewerId: null,
  reviewedAt: null,
  reviewNote: null,
  createdAt: "2026-10-23T00:00:00.000Z",
};

describe("safety report review routes", () => {
  const app = createApp();

  beforeEach(() => vi.clearAllMocks());

  it("lets an authenticated member submit a bounded report", async () => {
    vi.mocked(safetyService.reportUser).mockResolvedValueOnce(report);
    await request(app)
      .post("/reports")
      .set("Authorization", "Bearer test")
      .send({ userId: "user-2", reason: "Harassment", details: "  Unwanted messages  " })
      .expect(201, report);
    expect(safetyService.reportUser).toHaveBeenCalledWith({
      reporterId: "viewer-1",
      reportedId: "user-2",
      reason: "Harassment",
      details: "Unwanted messages",
      messageId: undefined,
    });
  });

  it("keeps the review queue inaccessible to regular members", async () => {
    await request(app).get("/reports/admin").set("Authorization", "Bearer test").expect(403);
    await request(app)
      .patch("/reports/report-1/review")
      .set("Authorization", "Bearer test")
      .send({ status: "RESOLVED" })
      .expect(403);
  });

  it("allows an administrator to filter and resolve reports", async () => {
    const resolved = {
      ...report,
      status: "RESOLVED" as const,
      reviewerId: "admin-1",
      reviewedAt: "2026-10-23T01:00:00.000Z",
      reviewNote: "Account action taken",
    };
    vi.mocked(safetyService.listReports).mockResolvedValueOnce({ items: [report] });
    vi.mocked(safetyService.reviewReport).mockResolvedValueOnce(resolved);

    await request(app)
      .get("/reports/admin?status=PENDING&limit=10")
      .set("Authorization", "Bearer admin")
      .expect(200, { items: [report] });
    await request(app)
      .patch("/reports/report-1/review")
      .set("Authorization", "Bearer admin")
      .send({ status: "RESOLVED", reviewNote: "  Account action taken  " })
      .expect(200, resolved);

    expect(safetyService.listReports).toHaveBeenCalledWith({ status: "PENDING", limit: 10 });
    expect(safetyService.reviewReport).toHaveBeenCalledWith("admin-1", "report-1", {
      status: "RESOLVED",
      reviewNote: "Account action taken",
    });
  });

  it("rejects unsupported review states and oversized moderation notes", async () => {
    await request(app)
      .patch("/reports/report-1/review")
      .set("Authorization", "Bearer admin")
      .send({ status: "PENDING" })
      .expect(400);
    await request(app)
      .patch("/reports/report-1/review")
      .set("Authorization", "Bearer admin")
      .send({ status: "RESOLVED", reviewNote: "x".repeat(2001) })
      .expect(400);
  });
});
