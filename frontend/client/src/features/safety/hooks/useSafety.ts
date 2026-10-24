import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

import {
  blockUser,
  changePassword,
  deleteAccount,
  listBlockedUsers,
  reportUser,
  unblockUser,
} from "../api/safetyApi";
import type { ReportReason } from "../types";

export function useBlockedUsers() {
  return useQuery({
    queryKey: queryKeys.safety.blocks,
    queryFn: listBlockedUsers,
    staleTime: 30_000,
  });
}

export function useBlockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: blockUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.follows.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.publicAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.safety.blocks });
    },
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unblockUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.safety.blocks });
      void queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
    },
  });
}

export function useReportUser() {
  return useMutation({
    mutationFn: (input: {
      userId: string;
      reason: ReportReason;
      messageId?: string;
      details?: string;
    }) => reportUser(input),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: deleteAccount,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => changePassword(currentPassword, newPassword),
  });
}
