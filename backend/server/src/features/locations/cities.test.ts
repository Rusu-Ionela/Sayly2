import { describe, expect, it } from "vitest";

import { cityKey, findCityInCountry, searchCities } from "./cities";

describe("city search per country", () => {
  it("lists the largest cities of Moldova when there is no query", () => {
    const cities = searchCities("MD");
    expect(cities.slice(0, 3)).toEqual(["Chisinau", "Tiraspol", "Bălţi"]);
    expect(cities).toEqual(expect.arrayContaining(["Rîbniţa", "Cahul"]));
  });

  it("matches without diacritics and prefers prefix matches", () => {
    expect(searchCities("MD", "balti")[0]).toBe("Bălţi");
    expect(searchCities("MD", "ribni")[0]).toBe("Rîbniţa");
  });

  it("never returns cities of another country", () => {
    expect(searchCities("MD", "Bucharest")).toEqual([]);
    expect(searchCities("RO", "Bucharest")[0]).toBe("Bucharest");
  });

  it("accepts English country names as well as ISO codes", () => {
    expect(searchCities("Moldova", "cahul")).toContain("Cahul");
  });

  it("returns nothing for an unknown country", () => {
    expect(searchCities("ZZ")).toEqual([]);
  });

  it("respects the limit", () => {
    expect(searchCities("RO", "", 5)).toHaveLength(5);
  });
});

describe("findCityInCountry", () => {
  it("returns the canonical spelling", () => {
    expect(findCityInCountry("MD", "balti")).toBe("Bălţi");
    expect(findCityInCountry("RO", "cluj-napoca")).toBe("Cluj-Napoca");
  });

  it("rejects a city from a different country", () => {
    expect(findCityInCountry("MD", "Cluj-Napoca")).toBeNull();
  });

  it("normalises case, diacritics and spacing", () => {
    expect(cityKey("  Bălţi ")).toBe("balti");
    expect(cityKey("Ştefan   Vodă")).toBe("stefan voda");
  });
});
