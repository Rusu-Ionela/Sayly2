import type { ReportStatus } from "../../db/schema";

export type BlockDto = {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
};

export type ReportDto = {
  id: string;
  reporterId: string;
  reportedId: string;
  messageId: string | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  reviewerId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
};

export const REPORT_REASONS = ["Spam", "Harassment", "Inappropriate Content"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REVIEW_STATUSES = ["IN_REVIEW", "RESOLVED", "DISMISSED"] as const;
export type ReportReviewStatus = (typeof REPORT_REVIEW_STATUSES)[number];

export type ReportsPage = {
  items: ReportDto[];
};
