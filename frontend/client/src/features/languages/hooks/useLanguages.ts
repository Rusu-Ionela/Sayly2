import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { isApiError } from "@/lib/api/errors";
import type { CurrentUserProfile } from "@/features/profile/types";
import { queryKeys } from "@/lib/queryKeys";
import type { ProficiencyLevel } from "../types";

import { getLanguages, getMyLanguages, putMyLanguages } from "../api/languagesApi";
import type { Language, LanguageType, UserLanguageItem, UserLanguagesGrouped } from "../types";
import {
  applyAddLanguage,
  applyProficiency,
  applyRemoveLanguage,
  canAddLanguage,
  canRemoveLanguage,
  duplicateLanguageMessage,
  findCatalogLanguage,
  patchProfileLanguages,
  toSyncPayload,
} from "../utils";

function languageErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.isNetwork) {
      return error.message;
    }
    if (error.isValidation) {
      return error.message || "Please check your language selections.";
    }
    if (error.status === 404) {
      return "That language is not in the catalog.";
    }
  }
  return "Could not update languages. Check your connection and try again.";
}

export function useLanguages() {
  return useQuery({
    queryKey: queryKeys.languages.catalog,
    queryFn: getLanguages,
    staleTime: 10 * 60 * 1000,
  });
}

function useUserLanguages(enabled = true) {
  return useQuery({
    queryKey: queryKeys.languages.mine,
    queryFn: getMyLanguages,
    enabled,
  });
}

type SyncContext = {
  previousGrouped: UserLanguagesGrouped | undefined;
  previousProfile: CurrentUserProfile | undefined;
};

function useSyncUserLanguages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: putMyLanguages,
    onMutate: async (payload): Promise<SyncContext> => {
      await queryClient.cancelQueries({ queryKey: queryKeys.languages.mine });

      const previousGrouped = queryClient.getQueryData<UserLanguagesGrouped>(
        queryKeys.languages.mine,
      );
      const previousProfile = queryClient.getQueryData<CurrentUserProfile>(queryKeys.profile.me);
      const catalog = queryClient.getQueryData<Language[]>(queryKeys.languages.catalog) ?? [];

      const optimistic = groupedFromPayload(payload, catalog, previousGrouped);
      queryClient.setQueryData(queryKeys.languages.mine, optimistic);

      if (previousProfile) {
        queryClient.setQueryData(
          queryKeys.profile.me,
          patchProfileLanguages(previousProfile, optimistic),
        );
      }

      return { previousGrouped, previousProfile };
    },
    onError: (_error, _payload, context) => {
      if (context?.previousGrouped) {
        queryClient.setQueryData(queryKeys.languages.mine, context.previousGrouped);
      }
      if (context?.previousProfile) {
        queryClient.setQueryData(queryKeys.profile.me, context.previousProfile);
      }
    },
    onSuccess: (grouped) => {
      queryClient.setQueryData(queryKeys.languages.mine, grouped);
      const profile = queryClient.getQueryData<CurrentUserProfile>(queryKeys.profile.me);
      if (profile) {
        queryClient.setQueryData(queryKeys.profile.me, patchProfileLanguages(profile, grouped));
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
    },
  });
}

function normalizeGrouped(data: UserLanguagesGrouped | undefined): UserLanguagesGrouped {
  return {
    SPEAKS: Array.isArray(data?.SPEAKS) ? data.SPEAKS : [],
    LEARNING: Array.isArray(data?.LEARNING) ? data.LEARNING : [],
  };
}

export function useManageUserLanguages() {
  const catalogQuery = useLanguages();
  const mineQuery = useUserLanguages();
  const sync = useSyncUserLanguages();

  const grouped = normalizeGrouped(mineQuery.data);
  const groupedRef = useRef(grouped);
  groupedRef.current = grouped;
  const catalog = catalogQuery.data ?? [];

  const run = (next: UserLanguagesGrouped) => {
    sync.mutate(toSyncPayload(next));
  };

  const addLanguage = (
    type: LanguageType,
    languageId: string,
    proficiency: ProficiencyLevel,
  ): string | null => {
    const current = groupedRef.current;
    const limitMessage = canAddLanguage(current, type);
    if (limitMessage) {
      return limitMessage;
    }
    const duplicateMessage = duplicateLanguageMessage(current, languageId);
    if (duplicateMessage) {
      return duplicateMessage;
    }
    const language = findCatalogLanguage(catalog, languageId);
    if (!language) {
      return "That language is not in the catalog.";
    }
    run(applyAddLanguage(current, type, language, proficiency));
    return null;
  };

  const setProficiency = (
    type: LanguageType,
    languageId: string,
    proficiency: ProficiencyLevel,
  ): string | null => {
    run(applyProficiency(groupedRef.current, type, languageId, proficiency));
    return null;
  };

  const removeLanguage = (type: LanguageType, languageId: string): string | null => {
    const current = groupedRef.current;
    const limitMessage = canRemoveLanguage(current, type);
    if (limitMessage) {
      return limitMessage;
    }
    run(applyRemoveLanguage(current, type, languageId));
    return null;
  };

  return {
    catalogQuery,
    mineQuery,
    grouped,
    catalog,
    isSaving: sync.isPending,
    addLanguage,
    setProficiency,
    removeLanguage,
    lastError: sync.error,
    errorMessage: sync.error ? languageErrorMessage(sync.error) : null,
    resetError: sync.reset,
    sync,
    refetch: () => {
      void catalogQuery.refetch();
      void mineQuery.refetch();
    },
  };
}

function groupedFromPayload(
  payload: {
    spokenLanguages: Array<{ languageId: string; proficiency: ProficiencyLevel }>;
    learningLanguages: Array<{ languageId: string; proficiency: ProficiencyLevel }>;
  },
  catalog: Language[],
  previous: UserLanguagesGrouped | undefined,
): UserLanguagesGrouped {
  const mapItems = (
    type: LanguageType,
    rows: Array<{ languageId: string; proficiency: ProficiencyLevel }>,
    previousRows: UserLanguageItem[] | undefined,
  ) =>
    rows.map((row) => {
      const previousItem = previousRows?.find((item) => item.languageId === row.languageId);
      const language = findCatalogLanguage(catalog, row.languageId);
      return {
        id: previousItem?.id ?? `optimistic-${type}-${row.languageId}`,
        languageId: row.languageId,
        code: previousItem?.code ?? language?.code ?? row.languageId,
        name: previousItem?.name ?? language?.name ?? row.languageId,
        flagEmoji: previousItem?.flagEmoji ?? language?.flagEmoji ?? "🏳️",
        type,
        proficiency: row.proficiency,
      };
    });

  return {
    SPEAKS: mapItems("SPEAKS", payload.spokenLanguages, previous?.SPEAKS),
    LEARNING: mapItems("LEARNING", payload.learningLanguages, previous?.LEARNING),
  };
}
