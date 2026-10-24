import { apiClient } from "@/lib/apiClient";
import type { MemberSummary } from "@/shared/types/member";

export type ConnectionStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
export type ConnectionDirection = "INCOMING" | "OUTGOING";

export type Connection = {
  id: string;
  status: ConnectionStatus;
  direction: ConnectionDirection;
  introMessage: string | null;
  createdAt: string;
  updatedAt: string;
  member: MemberSummary;
};

export type ConnectionsPage = {
  incoming: Connection[];
  outgoing: Connection[];
  accepted: Connection[];
};

export function getConnection(userId: string) {
  return apiClient.get<Connection | null>(`/connections/with/${encodeURIComponent(userId)}`);
}

export function listConnections() {
  return apiClient.get<ConnectionsPage>("/connections");
}

export function requestConnection(userId: string, introMessage?: string) {
  return apiClient.post<Connection>(`/connections/${encodeURIComponent(userId)}`, {
    ...(introMessage ? { introMessage } : {}),
  });
}

export function respondToConnection(id: string, action: "ACCEPT" | "DECLINE" | "CANCEL" | "REMOVE") {
  return apiClient.patch<Connection>(`/connections/${encodeURIComponent(id)}`, { action });
}
