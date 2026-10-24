import { endCallBetween } from "../calls/service";
import { emitToUsers } from "../messaging/gateway";
import * as safetyRepository from "./repository";
import type { ReportDto, ReportReviewStatus } from "./types";

export async function blockUser(blockerId: string, blockedId: string) {
  const block = await safetyRepository.createBlock(blockerId, blockedId);
  // A call already in progress must not outlive the block.
  const call = await endCallBetween(blockerId, blockedId).catch(() => null);
  if (call) {
    emitToUsers([blockerId, blockedId], "call_ended", { callId: call.callId, reason: "ended" });
  }
  return block;
}

export function listBlocks(blockerId: string) {
  return safetyRepository.listBlocks(blockerId);
}

export function unblockUser(blockerId: string, blockedId: string) {
  return safetyRepository.deleteBlock(blockerId, blockedId);
}

export function reportUser(input: {
  reporterId: string;
  reportedId: string;
  reason: string;
  messageId?: string;
  details?: string;
}) {
  return safetyRepository.createReport(input);
}

export function listReports(input: { status?: ReportDto["status"]; limit: number }) {
  return safetyRepository.listReports(input);
}

export function reviewReport(
  adminId: string,
  reportId: string,
  input: { status: ReportReviewStatus; reviewNote?: string },
) {
  return safetyRepository.reviewReport(adminId, reportId, input);
}

export { assertNotBlocked, isBlockedEitherWay } from "./repository";
