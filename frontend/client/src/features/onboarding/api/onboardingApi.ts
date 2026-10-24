import { apiClient } from "@/lib/apiClient";

import { completeOnboarding } from "@/features/profile/api/profileApi";

import type { OnboardingDraft, OnboardingStep } from "../model/onboardingFlow";

export { completeOnboarding };

export type PersistedOnboardingDraft = {
  step: OnboardingStep;
  questionIndex: number;
  draft: OnboardingDraft;
};

export function getOnboardingDraft() {
  return apiClient.get<PersistedOnboardingDraft | null>("/users/me/onboarding-draft");
}

export function saveOnboardingDraft(body: PersistedOnboardingDraft) {
  return apiClient.put<PersistedOnboardingDraft>("/users/me/onboarding-draft", body);
}
