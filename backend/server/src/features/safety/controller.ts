import type { Request, Response } from "express";

import { requireUserId } from "../../shared/middleware/requireUserId";

import { createBlockSchema, createReportSchema, listReportsSchema, reviewReportSchema } from "./schema";
import * as safetyService from "./service";

export async function createBlock(req: Request, res: Response) {
  const body = createBlockSchema.parse(req.body);
  res.status(201).json(await safetyService.blockUser(requireUserId(req), body.userId));
}

export async function listBlocks(req: Request, res: Response) {
  res.json(await safetyService.listBlocks(requireUserId(req)));
}

export async function removeBlock(req: Request, res: Response) {
  const blockedId = String(req.params.userId ?? "");
  await safetyService.unblockUser(requireUserId(req), blockedId);
  res.status(204).send();
}

export async function createReport(req: Request, res: Response) {
  const body = createReportSchema.parse(req.body);
  res.status(201).json(
    await safetyService.reportUser({
      reporterId: requireUserId(req),
      reportedId: body.userId,
      reason: body.reason,
      details: body.details,
      messageId: body.messageId,
    }),
  );
}

export async function listReports(req: Request, res: Response) {
  const query = listReportsSchema.parse(req.query);
  res.json(await safetyService.listReports(query));
}

export async function reviewReport(req: Request, res: Response) {
  const reportId = String(req.params.reportId ?? "");
  const body = reviewReportSchema.parse(req.body);
  res.json(await safetyService.reviewReport(requireUserId(req), reportId, body));
}
