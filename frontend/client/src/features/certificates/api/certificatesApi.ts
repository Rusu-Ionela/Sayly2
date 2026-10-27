import { apiClient } from "@/lib/apiClient";
import type { CefrLevel } from "@sayly/shared";

export type Price = {
  currency: string;
  /** Minor units (cents). */
  amountMinor: number;
  originalAmountMinor: number;
};

export type CertificateTest = {
  level: CefrLevel;
  name: string;
  summary: string;
  durationMinutes: number;
  format: "ONLINE";
  instantResult: boolean;
  price: Price;
};

export type CertificateOffers = {
  tests: CertificateTest[];
  freeRetake: boolean;
  /** False until checkout is live. */
  purchasable: boolean;
};

export function getCertificateOffers() {
  return apiClient.get<CertificateOffers>("/certificates/offers");
}
