import { Alert } from "react-native";

/**
 * The one entry point to Sayly Pro (Settings → Subscription, the profile Pro card, locked
 * Pro lists). Checkout is not live yet, so it explains the status instead of selling.
 */
export function showProInfo(isPro: boolean) {
  Alert.alert(
    "Sayly Pro",
    isPro
      ? "Your Pro membership is active. Thank you for supporting Sayly!"
      : "Pro unlocks your profile visitors, the profiles you viewed and more. Upgrades open soon — we will let you know as soon as they are available.",
  );
}
