import { useMemo, useState } from "react";

import { countryFlagEmoji, findCountry, searchCountries, type Country } from "@sayly/shared";

import { SearchablePicker, type PickerItem } from "@/shared/components/SearchablePicker";

type CountryPickerProps = {
  value: string;
  /** Receives the ISO 3166-1 alpha-2 code ("" when cleared). */
  onChange: (country: string) => void;
  placeholder?: string;
  allowClear?: boolean;
};

const toItem = (country: Country): PickerItem => ({
  key: country.code,
  label: country.name,
  detail: country.code,
  leading: countryFlagEmoji(country.code),
});

export function CountryPicker({
  value,
  onChange,
  placeholder = "Select your country",
  allowClear = false,
}: CountryPickerProps) {
  const [query, setQuery] = useState("");
  const selected = findCountry(value);

  const items = useMemo(() => searchCountries(query).map(toItem), [query]);

  return (
    <SearchablePicker
      valueLabel={selected ? selected.name : value}
      placeholder={placeholder}
      leading={selected ? countryFlagEmoji(selected.code) : "🌍"}
      accessibilityLabel="Country"
      sheetTitle="Choose country"
      searchPlaceholder="Search country…"
      items={items}
      selectedKey={selected?.code}
      query={query}
      onQueryChange={setQuery}
      onSelect={(item) => onChange(item.key)}
      onClear={allowClear ? () => onChange("") : undefined}
      emptyText={`No countries match "${query.trim()}".`}
    />
  );
}
