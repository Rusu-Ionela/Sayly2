import * as StoreReview from "expo-store-review";
import { Platform } from "react-native";

import { openExternalUrl } from "@/shared/utils/openExternal";

import { STORE_LINKS } from "../model/supportLinks";

/**
 * "Make our day and rate us": the system review sheet when the store offers it, otherwise
 * the app's store page. The OS decides whether the sheet actually shows (it is rate
 * limited), so there is no success message to give.
 */
export async function rateApp() {
  try {
    if ((await StoreReview.isAvailableAsync()) && (await StoreReview.hasAction())) {
      await StoreReview.requestReview();
      return;
    }
  } catch {
    // Fall through to the store page.
  }
  const url =
    StoreReview.storeUrl() ?? (Platform.OS === "ios" ? STORE_LINKS.ios : STORE_LINKS.android);
  openExternalUrl(url, "Rate Sayly", "Search for Sayly in your app store to leave a review.");
}
