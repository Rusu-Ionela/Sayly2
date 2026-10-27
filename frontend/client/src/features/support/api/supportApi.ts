import type { CreateSupportTicketInput, SupportTicketDto, SupportTicketKind } from "@sayly/shared";

import { apiClient } from "@/lib/apiClient";

/** Bug reports and feature requests have their own routes; the kind comes from the route. */
const ENDPOINTS: Record<SupportTicketKind, string> = {
  CONTACT: "/support/tickets",
  BUG_REPORT: "/support/bug-report",
  FEATURE_REQUEST: "/support/feature-request",
};

/** The server adds who sent it and their email from the session. */
export function createSupportTicket({ kind, ...rest }: CreateSupportTicketInput) {
  const body = kind === "CONTACT" ? { kind, ...rest } : rest;
  return apiClient.post<SupportTicketDto>(ENDPOINTS[kind], body);
}
