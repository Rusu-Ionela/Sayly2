import { isApiError } from "@/lib/api/errors";
import type { ReferenceSummaryDto } from "@sayly/shared";

/** "No references yet" · "1 reference · 1 positive" · "12 references · 11 positive". */
export function describeReferences(summary: ReferenceSummaryDto | undefined): string {
  if (!summary || summary.total === 0) {
    return "No references yet";
  }
  const total = `${summary.total} ${summary.total === 1 ? "reference" : "references"}`;
  return `${total} · ${summary.positive} positive`;
}

export const RATING_LABELS: Record<number, string> = {
  1: "Not a good fit",
  2: "Could be better",
  3: "Good",
  4: "Great partner",
  5: "Amazing partner",
};

/**
 * Message for a failed save or delete. Client errors carry the server's reason (for example
 * "Chat with this person first…"); network and server failures get a retry hint.
 */
export function referenceErrorMessage(error: unknown, fallback: string): string {
  if (isApiError(error) && error.status >= 400 && error.status < 500 && !error.isRateLimited) {
    return error.message;
  }
  return fallback;
}
