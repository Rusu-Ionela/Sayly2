import { z } from "zod";

import { boundedIdSchema } from "../../shared/validation/text";

export const userIdParamSchema = z.object({ userId: boundedIdSchema });

export const referencesPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
