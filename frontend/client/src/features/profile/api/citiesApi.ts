import { apiClient } from "@/lib/apiClient";

type CitySearchResponse = {
  country: string;
  cities: string[];
};

/** Cities of one country only (server-side GeoNames index), most populous first. */
export function searchCities(country: string, query: string) {
  const params = new URLSearchParams({ q: query.trim(), limit: "40" });
  return apiClient.get<CitySearchResponse>(
    `/locations/countries/${encodeURIComponent(country)}/cities?${params.toString()}`,
  );
}
