import {
  useMutation,
  useQuery,
  useQueryClient,
  type MutationOptions,
  type QueryClient,
} from "@tanstack/react-query";

import type { Language } from "@/features/languages/types";
import { queryKeys } from "@/lib/queryKeys";

import { getMe, getPublicProfile, updateProfile, updateSettings } from "../api/profileApi";
import { profileErrorMessage } from "../model/profileErrors";
import { applyProfilePatch, applySettingsPatch } from "../model/profilePatch";
import type { CurrentUserProfile, UpdateProfilePayload, UpdateSettingsPayload } from "../types";

const UPDATE_PROFILE_KEY = ["profile", "update"] as const;
const UPDATE_SETTINGS_KEY = ["profile", "settings"] as const;

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile.me,
    queryFn: getMe,
  });
}

export function usePublicProfile(userId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.profile.public(userId),
    queryFn: () => getPublicProfile(userId),
    enabled: Boolean(userId) && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}

type MeContext = { previous?: CurrentUserProfile };
type MeMutationOptions<TPayload> = MutationOptions<
  CurrentUserProfile,
  unknown,
  TPayload,
  MeContext
>;

type UpdateOptions = {
  /**
   * Receives a user-facing message after rollback. Runs even if the calling screen has
   * already unmounted (callbacks passed to `save()` itself would not).
   */
  onError?: (message: string) => void;
};

/**
 * Optimistic write against the cached GET /users/me payload, shared by profile edits and
 * settings toggles: the cache changes instantly, is replaced by the server's version on
 * success, and rolls back to the snapshot on error.
 */
function optimisticMeMutation<TPayload>(
  queryClient: QueryClient,
  config: {
    mutationKey: readonly unknown[];
    mutationFn: (payload: TPayload) => Promise<CurrentUserProfile>;
    project: (profile: CurrentUserProfile, payload: TPayload) => CurrentUserProfile;
    onSettled?: (profile: CurrentUserProfile | undefined, payload: TPayload) => void;
  },
  options?: UpdateOptions,
): MeMutationOptions<TPayload> {
  return {
    mutationKey: config.mutationKey,
    mutationFn: config.mutationFn,
    onMutate: async (payload) => {
      // Stop an in-flight refetch from overwriting the optimistic value.
      await queryClient.cancelQueries({ queryKey: queryKeys.profile.me });

      const previous = queryClient.getQueryData<CurrentUserProfile>(queryKeys.profile.me);
      if (previous) {
        queryClient.setQueryData(queryKeys.profile.me, config.project(previous, payload));
      }
      return { previous };
    },
    onError: (error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.profile.me, context.previous);
      }
      options?.onError?.(profileErrorMessage(error));
    },
    onSuccess: (profile) => {
      // A newer write is still in flight: keep its optimistic state, its response wins.
      if (queryClient.isMutating({ mutationKey: config.mutationKey }) <= 1) {
        queryClient.setQueryData(queryKeys.profile.me, profile);
      }
    },
    onSettled: (profile, _error, payload) => {
      if (profile) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.profile.public(profile.id) });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
      config.onSettled?.(profile, payload);
    },
  };
}

/** PRO-002 edit profile. Exported for unit tests of the cache choreography. */
export function updateProfileMutationOptions(queryClient: QueryClient, options?: UpdateOptions) {
  return optimisticMeMutation<UpdateProfilePayload>(
    queryClient,
    {
      mutationKey: UPDATE_PROFILE_KEY,
      mutationFn: updateProfile,
      project: (profile, payload) =>
        applyProfilePatch(
          profile,
          payload,
          queryClient.getQueryData<Language[]>(queryKeys.languages.catalog) ?? [],
        ),
      onSettled: (_profile, payload) => {
        if (payload.spokenLanguages) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.languages.mine });
        }
      },
    },
    options,
  );
}

/** Privacy + notification toggles. Exported for unit tests. */
export function updateSettingsMutationOptions(queryClient: QueryClient, options?: UpdateOptions) {
  return optimisticMeMutation<UpdateSettingsPayload>(
    queryClient,
    {
      mutationKey: UPDATE_SETTINGS_KEY,
      mutationFn: updateSettings,
      project: applySettingsPatch,
    },
    options,
  );
}

function toSaveApi<TPayload>(mutation: {
  mutate: (payload: TPayload) => void;
  mutateAsync: (payload: TPayload) => Promise<CurrentUserProfile>;
  isPending: boolean;
  error: unknown;
  reset: () => void;
}) {
  return {
    save: mutation.mutate,
    saveAsync: mutation.mutateAsync,
    isSaving: mutation.isPending,
    error: mutation.error,
    errorMessage: mutation.error ? profileErrorMessage(mutation.error) : null,
    reset: mutation.reset,
  };
}

export function useUpdateProfile(options?: UpdateOptions) {
  const queryClient = useQueryClient();
  return toSaveApi(useMutation(updateProfileMutationOptions(queryClient, options)));
}

export function useUpdateSettings(options?: UpdateOptions) {
  const queryClient = useQueryClient();
  return toSaveApi(useMutation(updateSettingsMutationOptions(queryClient, options)));
}
