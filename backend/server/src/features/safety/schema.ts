import { z } from "zod";

import { REPORT_REASONS, REPORT_REVIEW_STATUSES } from "./types";

export const createBlockSchema = z.object({
  userId: z.string().min(1),
});

export const createReportSchema = z.object({
  userId: z.string().min(1),
  reason: z.enum(REPORT_REASONS),
  messageId: z.string().min(1).optional(),
  details: z.string().trim().max(1000).optional(),
});

export const listReportsSchema = z.object({
  status: z.enum(["PENDING", ...REPORT_REVIEW_STATUSES] as const).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const reviewReportSchema = z.object({
  status: z.enum(REPORT_REVIEW_STATUSES),
  reviewNote: z.string().trim().max(2000).optional(),
});
