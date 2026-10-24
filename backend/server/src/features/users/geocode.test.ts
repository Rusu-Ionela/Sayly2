import { afterEach, describe, expect, it, vi } from "vitest";

import { geocodePlace } from "./geocode";

function nominatim(body: unknown, init?: ResponseInit) {
  return vi.fn(async (_url: unknown, _init?: unknown) => new Response(JSON.stringify(body), init));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("geocodePlace", () => {
  it("returns coordinates rounded to ~1 km", async () => {
    vi.stubGlobal("fetch", nominatim([{ lat: "55.755826", lon: "37.6173" }]));
    await expect(geocodePlace("Moscow", "RU")).resolves.toEqual({ latitude: 55.76, longitude: 37.62 });
  });

  it("searches the city inside the country, with an identifying User-Agent", async () => {
    const fetchMock = nominatim([{ lat: "1", lon: "2" }]);
    vi.stubGlobal("fetch", fetchMock);
    await geocodePlace("  Moscow ", "Russia");

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get("q")).toBe("Moscow");
    expect(url.searchParams.get("countrycodes")).toBe("ru");
    const headers = (fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers;
    expect(headers["User-Agent"]).toBeTruthy();
  });

  it("falls back to the country name when there is no city", async () => {
    const fetchMock = nominatim([{ lat: "61.5", lon: "105.3" }]);
    vi.stubGlobal("fetch", fetchMock);
    await geocodePlace(null, "RU");
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get("q")).toBe("Russia");
  });

  it("returns null for an unknown country without calling the network", async () => {
    const fetchMock = nominatim([]);
    vi.stubGlobal("fetch", fetchMock);
    await expect(geocodePlace("Moscow", "Atlantis")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when nothing matches", async () => {
    vi.stubGlobal("fetch", nominatim([]));
    await expect(geocodePlace("Nowhereville", "RU")).resolves.toBeNull();
  });

  it("returns null on an error status, bad payload, or network failure", async () => {
    vi.stubGlobal("fetch", nominatim({ error: "x" }, { status: 500 }));
    await expect(geocodePlace("Moscow", "RU")).resolves.toBeNull();

    vi.stubGlobal("fetch", nominatim({ unexpected: true }));
    await expect(geocodePlace("Moscow", "RU")).resolves.toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(geocodePlace("Moscow", "RU")).resolves.toBeNull();
  });
});
