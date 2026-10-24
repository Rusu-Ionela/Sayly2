import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getMe } from "@/features/profile/api/profileApi";
import { queryKeys } from "@/lib/queryKeys";

import {
  completeOnboarding,
  getOnboardingDraft,
  saveOnboardingDraft,
  type PersistedOnboardingDraft,
} from "../api/onboardingApi";

const onboardingDraftKey = ["onboarding", "draft"] as const;

export function useCurrentUser(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.profile.me,
    queryFn: getMe,
    enabled,
    retry: 1,
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeOnboarding,
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.profile.me, profile);
      queryClient.removeQueries({ queryKey: onboardingDraftKey });
    },
  });
}

export function useOnboardingDraft(enabled: boolean) {
  return useQuery({
    queryKey: onboardingDraftKey,
    queryFn: getOnboardingDraft,
    enabled,
    retry: 1,
    staleTime: 0,
  });
}

export function useSaveOnboardingDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveOnboardingDraft,
    onSuccess: (draft: PersistedOnboardingDraft) => {
      queryClient.setQueryData(onboardingDraftKey, draft);
    },
  });
}
