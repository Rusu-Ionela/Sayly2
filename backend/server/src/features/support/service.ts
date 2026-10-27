import type { CreateSupportTicketInput, SupportTicketDto } from "@sayly/shared";
import { logger } from "../../shared/utils/logger";

import * as supportRepository from "./repository";

/** Saves a contact message, feature request or bug report from the signed-in member. */
export async function createTicket(
  userId: string,
  input: CreateSupportTicketInput,
): Promise<SupportTicketDto> {
  const email = await supportRepository.getActiveMemberEmail(userId);
  const ticket = await supportRepository.insertTicket(userId, email, input);
  logger.info("support", "ticket created", {
    ticketId: ticket.id,
    kind: ticket.kind,
    topic: ticket.topic,
    platform: input.device?.platform,
  });
  return ticket;
}

/** Your own tickets, newest first. */
export async function listTickets(userId: string): Promise<{ items: SupportTicketDto[] }> {
  return { items: await supportRepository.listTickets(userId) };
}
