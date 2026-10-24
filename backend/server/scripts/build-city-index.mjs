/**
 * Builds src/features/locations/data/cities.json from GeoNames `cities1000.txt`
 * (https://download.geonames.org/export/dump/cities1000.zip, CC BY 4.0, geonames.org).
 *
 *   node scripts/build-city-index.mjs path/to/cities1000.txt
 *
 * Output: { "<ISO2>": ["City", ...] } — unique names per country, most populous first.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/build-city-index.mjs path/to/cities1000.txt");
  process.exit(1);
}

// Neighbourhoods, historical and abandoned places are not cities people live in.
const EXCLUDED_FEATURES = new Set(["PPLX", "PPLH", "PPLQ", "PPLW"]);

const byCountry = new Map();
const lines = readline.createInterface({ input: fs.createReadStream(input, "utf8") });
for await (const line of lines) {
  const cols = line.split("\t");
  const name = cols[1]?.trim();
  const feature = cols[7];
  const country = cols[8];
  const population = Number(cols[14]) || 0;
  if (!name || !country || EXCLUDED_FEATURES.has(feature)) continue;
  if (!byCountry.has(country)) byCountry.set(country, new Map());
  const cities = byCountry.get(country);
  cities.set(name, Math.max(cities.get(name) ?? 0, population));
}

const output = {};
for (const country of [...byCountry.keys()].sort()) {
  output[country] = [...byCountry.get(country).entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}

const target = path.resolve("src/features/locations/data/cities.json");
fs.writeFileSync(target, JSON.stringify(output));
const total = Object.values(output).reduce((sum, list) => sum + list.length, 0);
console.log(`Wrote ${total} cities in ${Object.keys(output).length} countries to ${target}`);
