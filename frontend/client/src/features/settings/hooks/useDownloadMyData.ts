import { useMutation } from "@tanstack/react-query";
import { Alert, Share } from "react-native";

import { exportMyData } from "@/features/profile/api/profileApi";
import { isApiError } from "@/lib/api/errors";

/**
 * Fetches the data export and hands it to the system share sheet, so the member can
 * save it to Files, email it or keep it in a notes app.
 */
export function useDownloadMyData() {
  return useMutation({
    mutationFn: exportMyData,
    onSuccess: async (data) => {
      await Share.share({
        title: "My Sayly data",
        message: JSON.stringify(data, null, 2),
      }).catch(() => undefined);
    },
    onError: (error) =>
      Alert.alert(
        "Could not prepare your data",
        isApiError(error) && error.isRateLimited
          ? "You requested your data a few times already. Try again in an hour."
          : "Check your connection and try again.",
      ),
  });
}
