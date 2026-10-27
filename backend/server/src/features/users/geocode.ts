import { z } from "zod";
import { normalizeCountryInput } from "@sayly/shared";

import { env } from "../../config/env";
import { logger } from "../../shared/utils/logger";


export type Coordinates = { latitude: number; longitude: number };

const responseSchema = z.array(z.object({ lat: z.string(), lon: z.string() }));

/** ~1 km, so a stored position can't pinpoint a home address. */
const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Looks up a city (or the country when no city is given) on OpenStreetMap's Nominatim.
 * Returns null on any failure: a missing map must never block saving a profile.
 * shortcut: public Nominatim (1 request/second policy), fine for profile saves only; use a paid geocoder at scale.
 */
export async function geocodePlace(
  city: string | null | undefined,
  country: string,
): Promise<Coordinates | null> {
  const iso = normalizeCountryInput(country);
  if (!iso) {
    return null;
  }
  const query = city?.trim() || new Intl.DisplayNames(["en"], { type: "region" }).of(iso);
  if (!query) {
    return null;
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", iso.toLowerCase());
  url.searchParams.set("q", query);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": env.geocoderUserAgent, "Accept-Language": "en" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return null;
    }
    const [hit] = responseSchema.parse(await response.json());
    if (!hit) {
      return null;
    }
    const latitude = Number(hit.lat);
    const longitude = Number(hit.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    return { latitude: round2(latitude), longitude: round2(longitude) };
  } catch (error) {
    logger.warn("geocode", "lookup failed", { message: (error as Error).message });
    return null;
  }
}
