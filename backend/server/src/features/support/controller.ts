import type { Request, Response } from "express";

import { requireUserId } from "../../shared/middleware/requireUserId";

import { createFeedbackSchema, createSupportTicketSchema } from "./schema";
import * as supportService from "./service";
import type { SupportTicketKind } from "./types";

/** POST /support/tickets — contact us, request a feature or report a bug. */
export async function createTicket(req: Request, res: Response) {
  const body = createSupportTicketSchema.parse(req.body);
  res.status(201).json(await supportService.createTicket(requireUserId(req), body));
}

/** GET /support/tickets — what you sent us. */
export async function listTickets(req: Request, res: Response) {
  res.json(await supportService.listTickets(requireUserId(req)));
}

/**
 * POST /support/bug-report and /support/feature-request — same tickets as /support/tickets,
 * with the kind taken from the route instead of the body.
 */
export function createFeedback(kind: Exclude<SupportTicketKind, "CONTACT">) {
  return async (req: Request, res: Response) => {
    const body = createFeedbackSchema.parse(req.body);
    res.status(201).json(await supportService.createTicket(requireUserId(req), { ...body, kind }));
  };
}
