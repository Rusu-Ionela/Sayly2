import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

import { getCertificateOffers } from "../api/certificatesApi";

export function useCertificateOffers() {
  return useQuery({
    queryKey: queryKeys.certificates.offers,
    queryFn: getCertificateOffers,
    staleTime: 60 * 60_000,
  });
}
