import { z } from "zod";

import { boundedIdSchema } from "../../shared/validation/text";

import { CALL_KINDS } from "./service";

export const callInviteSchema = z.object({
  conversationId: boundedIdSchema,
  kind: z.enum(CALL_KINDS),
});

export const callIdSchema = z.object({ callId: boundedIdSchema });

/** WebRTC offer/answer/ICE relayed verbatim; size-capped so it can't be used to flood the peer. */
export const callSignalSchema = z.object({
  callId: boundedIdSchema,
  data: z
    .record(z.string(), z.unknown())
    .refine((value) => JSON.stringify(value).length <= 20_000, "Signal too large"),
});
