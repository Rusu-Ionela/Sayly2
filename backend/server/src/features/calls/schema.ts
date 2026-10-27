import { CALL_KINDS, callSignalDataSchema } from "@sayly/shared";
import { z } from "zod";

import { boundedIdSchema } from "../../shared/validation/text";

export const callInviteSchema = z.object({
  conversationId: boundedIdSchema,
  kind: z.enum(CALL_KINDS),
});

export const callIdSchema = z.object({ callId: boundedIdSchema });

/** Only well-formed offers, answers and ICE candidates are relayed, each size-capped. */
export const callSignalSchema = z.object({
  callId: boundedIdSchema,
  data: callSignalDataSchema,
});
