import { z } from "zod";

/** `?limit=&offset=` for list endpoints (bad values fall back to defaults). */
export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).catch(20),
  offset: z.coerce.number().int().min(0).catch(0),
});

export type PageQuery = z.infer<typeof pageQuerySchema>;
