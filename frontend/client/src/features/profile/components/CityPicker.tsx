import { useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { SearchablePicker, type PickerItem } from "@/shared/components/SearchablePicker";
import { useColors } from "@/shared/theme";
import { findCountry } from "@sayly/shared";

import { useCitySearch } from "../hooks/useCitySearch";

type CityPickerProps = {
  /** ISO code (or legacy name) of the selected country — cities come from it only. */
  country: string;
  value: string;
  /** Receives the canonical city name ("" when cleared). */
  onChange: (city: string) => void;
};

/** City field tied to the selected country: disabled until a country is chosen. */
export function CityPicker({ country, value, onChange }: CityPickerProps) {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const countryName = findCountry(country)?.name ?? country;
  const hasCountry = Boolean(country.trim());
  const cities = useCitySearch(country, query, hasCountry);

  const items = useMemo<PickerItem[]>(
    () => (cities.data ?? []).map((city) => ({ key: city, label: city })),
    [cities.data],
  );

  return (
    <SearchablePicker
      valueLabel={value}
      placeholder={hasCountry ? `Select a city in ${countryName}` : "Select a city"}
      leading="📍"
      accessibilityLabel="City"
      sheetTitle={`Cities in ${countryName}`}
      searchPlaceholder="Search city…"
      items={items}
      selectedKey={value}
      query={query}
      onQueryChange={setQuery}
      onSelect={(item) => onChange(item.key)}
      onClear={() => onChange("")}
      disabled={!hasCountry}
      hint={hasCountry ? undefined : "Choose your country first."}
      loading={cities.isFetching}
      emptyText={
        query.trim()
          ? `No cities in ${countryName} match "${query.trim()}".`
          : `No cities found for ${countryName}.`
      }
      listHeader={
        cities.isError ? (
          <Text style={[styles.error, { color: colors.rose }]}>
            Could not load cities. Check your connection and try again.
          </Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  error: {
    fontSize: 13,
    marginBottom: 8,
  },
});
