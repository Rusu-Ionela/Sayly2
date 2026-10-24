import type { ConnectionStatus } from "../../db/schema";
import type { MemberSummaryDto } from "../users/memberSummary";

export type ConnectionDirection = "INCOMING" | "OUTGOING";

export type ConnectionDto = {
  id: string;
  status: ConnectionStatus;
  direction: ConnectionDirection;
  introMessage: string | null;
  createdAt: string;
  updatedAt: string;
  member: MemberSummaryDto;
};

export type ConnectionsPage = {
  incoming: ConnectionDto[];
  outgoing: ConnectionDto[];
  accepted: ConnectionDto[];
};
