import type { Request, Response } from "express";

import { searchCities } from "./cities";
import { citySearchParamsSchema, citySearchQuerySchema } from "./schema";

/** GET /locations/countries/:country/cities?q=&limit= — cities of that country only. */
export function listCities(req: Request, res: Response) {
  const { country } = citySearchParamsSchema.parse(req.params);
  const { q, limit } = citySearchQuerySchema.parse(req.query);
  // Reference data: identical for every user, safe to cache briefly.
  res.set("Cache-Control", "private, max-age=3600");
  res.json({ country, cities: searchCities(country, q, limit) });
}
