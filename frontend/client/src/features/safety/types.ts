export const REPORT_REASONS = ["Spam", "Harassment", "Inappropriate Content"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export type BlockResult = {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
};

export type ReportResult = {
  id: string;
  reporterId: string;
  reportedId: string;
  messageId: string | null;
  reason: string;
  details: string | null;
  createdAt: string;
};
