import type { CefrLevel } from "../../db/schema";

import type { CertificateOffersDto, CertificateTestDto } from "./types";

/** Launch promotion: every level costs the same. Amounts are in minor units (cents). */
const PRICE = { currency: "USD", amountMinor: 266, originalAmountMinor: 443 } as const;

const LEVELS: Array<{ level: CefrLevel; name: string; summary: string }> = [
  {
    level: "A2",
    name: "Elementary",
    summary: "Handle everyday situations: shopping, directions, simple conversations.",
  },
  {
    level: "B1",
    name: "Intermediate",
    summary: "Talk about experiences, plans and opinions; get by while travelling.",
  },
  {
    level: "B2",
    name: "Upper intermediate",
    summary: "Discuss complex topics fluently and spontaneously with native speakers.",
  },
  {
    level: "C1",
    name: "Advanced",
    summary: "Use the language flexibly for social, academic and professional purposes.",
  },
];

const TESTS: CertificateTestDto[] = LEVELS.map((entry) => ({
  ...entry,
  durationMinutes: 45,
  format: "ONLINE",
  instantResult: true,
  price: PRICE,
}));

export const CERTIFICATE_OFFERS: CertificateOffersDto = {
  tests: TESTS,
  freeRetake: true,
  /** Tests cannot be bought yet — the client shows the offer without a checkout. */
  purchasable: false,
};
