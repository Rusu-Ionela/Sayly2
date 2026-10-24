import type { Language } from "@/features/languages/types";
import { findCatalogLanguage } from "@/features/languages/utils";

import type { CertificateRowData } from "../components/CertificateList";
import type { CertificateFormValues } from "../schema";
import type { Certificate } from "../types";

/** Saved certificates → list rows. */
export function certificateRows(certificates: readonly Certificate[]): CertificateRowData[] {
  return certificates.map((item) => ({
    key: item.id,
    flagEmoji: item.flagEmoji,
    languageName: item.languageName,
    level: item.level,
    title: item.title,
    issuedYear: item.issuedYear,
  }));
}

/** Form entries (language ids only) → list rows; keyed by position in the form array. */
export function certificateFormRows(
  certificates: readonly CertificateFormValues[],
  catalog: readonly Language[],
): CertificateRowData[] {
  return certificates.map((item, index) => {
    const language = findCatalogLanguage([...catalog], item.languageId);
    return {
      key: String(index),
      flagEmoji: language?.flagEmoji ?? "",
      languageName: language?.name ?? item.languageId,
      level: item.level,
      title: item.title,
      issuedYear: item.issuedYear,
    };
  });
}

export function toCertificateFormValues(
  certificates: readonly Certificate[],
): CertificateFormValues[] {
  return certificates.map((item) => ({
    languageId: item.languageId,
    level: item.level,
    title: item.title,
    issuedYear: item.issuedYear,
  }));
}
