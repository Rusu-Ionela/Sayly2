import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";
import { useDebounce } from "@/shared/hooks/useDebounce";

import { searchCities } from "../api/citiesApi";

/** Cities of `country` matching `query` (debounced while typing). Off until a country is set. */
export function useCitySearch(country: string, query: string, enabled = true) {
  const debounced = useDebounce(query.trim(), 250);
  return useQuery({
    queryKey: queryKeys.locations.cities(country, debounced),
    queryFn: () => searchCities(country, debounced),
    enabled: enabled && Boolean(country),
    staleTime: 60 * 60_000,
    placeholderData: keepPreviousData,
    select: (data) => data.cities,
  });
}
