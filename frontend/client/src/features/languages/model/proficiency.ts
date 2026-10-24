/** Format proficiency enums for display (e.g. UPPER_INTERMEDIATE → Upper Intermediate). */
export function formatProficiencyLabel(level: string) {
  return level
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
