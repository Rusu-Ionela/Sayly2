import { z } from "zod";

import { boundedIdSchema, multilineTextSchema } from "../../shared/validation/text";

import { RATING_MAX, RATING_MIN, REFERENCE_BODY_MAX, type SaveReferenceInput } from "./types";

/** POST /users/:userId/references — strict, so a client can't pick the author. */
export const saveReferenceSchema = z
  .object({
    rating: z.number().int().min(RATING_MIN).max(RATING_MAX),
    body: multilineTextSchema(REFERENCE_BODY_MAX, "Reference").pipe(
      z.string().min(1, "Write a few words about your exchange"),
    ),
  })
  .strict() satisfies z.ZodType<SaveReferenceInput>;

export const userIdParamSchema = z.object({ userId: boundedIdSchema });

export const referencesPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
