import { apiClient } from "@/lib/apiClient";

/** Mirrors the backend enums in features/support/types.ts. */
export type SupportTicketKind = "CONTACT" | "FEATURE_REQUEST" | "BUG_REPORT";
export type SupportTopic = "ACCOUNT" | "SECURITY" | "LANGUAGE_EXCHANGE" | "PRO" | "OTHER";
export type DevicePlatform = "IOS" | "ANDROID" | "WEB";

export type DeviceContext = {
  appVersion: string;
  platform: DevicePlatform;
  osVersion?: string;
  deviceModel?: string;
};

export type CreateSupportTicketInput = {
  kind: SupportTicketKind;
  topic?: SupportTopic;
  subject: string;
  message: string;
  device?: DeviceContext;
};

export type SupportTicket = {
  id: string;
  kind: SupportTicketKind;
  topic: SupportTopic | null;
  subject: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  contactEmail: string;
  createdAt: string;
};

/** Bug reports and feature requests have their own routes; the kind comes from the route. */
const ENDPOINTS: Record<SupportTicketKind, string> = {
  CONTACT: "/support/tickets",
  BUG_REPORT: "/support/bug-report",
  FEATURE_REQUEST: "/support/feature-request",
};

/** The server adds who sent it and their email from the session. */
export function createSupportTicket({ kind, ...rest }: CreateSupportTicketInput) {
  const body = kind === "CONTACT" ? { kind, ...rest } : rest;
  return apiClient.post<SupportTicket>(ENDPOINTS[kind], body);
}
