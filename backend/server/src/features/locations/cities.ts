import { normalizeCountryInput } from "@sayly/shared";
import cityIndex from "./data/cities.json";


/**
 * Cities per ISO 3166-1 alpha-2 country, most populous first.
 * Source: GeoNames cities1000 (CC BY 4.0, https://www.geonames.org) —
 * regenerate with `node scripts/build-city-index.mjs`.
 */
const CITIES_BY_COUNTRY: Readonly<Record<string, readonly string[]>> = cityIndex;

export const DEFAULT_CITY_RESULTS = 30;
export const MAX_CITY_RESULTS = 50;

/** Case- and diacritic-insensitive key: "Bălţi", "Balti" and "BALȚI" all match. */
export function cityKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Lazily built per country: lookup key → canonical name. */
const keyIndexCache = new Map<string, Map<string, string>>();

function citiesOf(country: string): readonly string[] {
  const code = normalizeCountryInput(country);
  return code ? (CITIES_BY_COUNTRY[code] ?? []) : [];
}

function keyIndexOf(country: string): Map<string, string> {
  const code = normalizeCountryInput(country) ?? "";
  let index = keyIndexCache.get(code);
  if (!index) {
    index = new Map();
    for (const name of citiesOf(code)) {
      const key = cityKey(name);
      if (!index.has(key)) index.set(key, name);
    }
    keyIndexCache.set(code, index);
  }
  return index;
}

/**
 * Cities of one country matching `query` — prefix matches first, then names containing
 * it, each group in population order. Empty query → the largest cities.
 */
export function searchCities(country: string, query = "", limit = DEFAULT_CITY_RESULTS): string[] {
  const cities = citiesOf(country);
  const needle = cityKey(query);
  if (!needle) {
    return cities.slice(0, limit);
  }

  const prefix: string[] = [];
  const contains: string[] = [];
  for (const name of cities) {
    const key = cityKey(name);
    if (key.startsWith(needle)) {
      prefix.push(name);
      if (prefix.length >= limit) break;
    } else if (contains.length < limit && key.includes(needle)) {
      contains.push(name);
    }
  }
  return [...prefix, ...contains].slice(0, limit);
}

/** The canonical spelling of `city` if it is a city of `country`; otherwise null. */
export function findCityInCountry(country: string, city: string): string | null {
  return keyIndexOf(country).get(cityKey(city)) ?? null;
}
