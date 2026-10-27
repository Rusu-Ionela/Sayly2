import { z } from "zod";
import { isValidCountryInput, normalizeCountryInput } from "@sayly/shared";


import { DEFAULT_CITY_RESULTS, MAX_CITY_RESULTS } from "./cities";

export const citySearchParamsSchema = z.object({
  country: z
    .string()
    .trim()
    .refine(isValidCountryInput, "Unknown country")
    .transform((value) => normalizeCountryInput(value) ?? value),
});

export const citySearchQuerySchema = z.object({
  q: z.string().max(60).optional().default(""),
  limit: z.coerce.number().int().min(1).max(MAX_CITY_RESULTS).optional().default(DEFAULT_CITY_RESULTS),
});
