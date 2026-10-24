import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import type { PublicUserProfile } from "@/features/profile/types";
import { queryKeys } from "@/lib/queryKeys";

import { followUser, getFollowing, unfollowUser } from "../api/followsApi";

export function useFollowing() {
  return useInfiniteQuery({
    queryKey: queryKeys.follows.all,
    queryFn: ({ pageParam }) => getFollowing(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 30_000,
  });
}

type FollowInput = { userId: string; follow: boolean };

/**
 * Follow / unfollow anyone. Their public profile flips instantly (rolled back if the
 * request fails); your Following count refreshes afterwards. The Following list itself
 * is left alone so a row you just unfollowed stays put until the list is reopened.
 */
export function useSetFollow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, follow }: FollowInput) =>
      follow ? followUser(userId) : unfollowUser(userId),
    onMutate: async ({ userId, follow }) => {
      const key = queryKeys.profile.public(userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PublicUserProfile>(key);
      if (previous) {
        queryClient.setQueryData<PublicUserProfile>(key, {
          ...previous,
          isFollowing: follow,
          followerCount: Math.max(0, previous.followerCount + (follow ? 1 : -1)),
        });
      }
      return { previous };
    },
    onError: (_error, { userId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.profile.public(userId), context.previous);
      }
    },
    onSettled: (_data, _error, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.public(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.me });
    },
  });
}

/** One member's follow toggle (their profile page). */
export function useToggleFollow(userId: string) {
  const mutation = useSetFollow();
  return {
    isPending: mutation.isPending,
    mutate: (follow: boolean) => mutation.mutate({ userId, follow }),
  };
}
