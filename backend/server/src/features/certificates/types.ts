import type { CefrLevel } from "../../db/schema";

export type PriceDto = {
  currency: string;
  /** Price in minor units (e.g. cents). */
  amountMinor: number;
  /** Price before the current promotion, in minor units. */
  originalAmountMinor: number;
};

export type CertificateTestDto = {
  level: CefrLevel;
  name: string;
  summary: string;
  durationMinutes: number;
  format: "ONLINE";
  instantResult: boolean;
  price: PriceDto;
};

export type CertificateOffersDto = {
  tests: CertificateTestDto[];
  /** A failed test can be retaken at no cost. */
  freeRetake: boolean;
  /** False until checkout is available. */
  purchasable: boolean;
};
