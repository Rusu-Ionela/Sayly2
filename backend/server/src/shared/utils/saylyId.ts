import { randomInt } from "crypto";

/** No 0/O, 1/I/L: the code is read aloud and typed by hand. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const SAYLY_ID_LENGTH = 8;

/** Matches a well-formed Sayly ID (case-insensitive input is upper-cased first). */
export const SAYLY_ID_PATTERN = new RegExp(`^[${ALPHABET}]{${SAYLY_ID_LENGTH}}$`);

/** Random public profile code, e.g. "K7QF3MZA" (31^8 ≈ 8.5e11 combinations). */
export function generateSaylyId(): string {
  let id = "";
  for (let i = 0; i < SAYLY_ID_LENGTH; i += 1) {
    id += ALPHABET[randomInt(ALPHABET.length)];
  }
  return id;
}
