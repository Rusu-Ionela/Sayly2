import { Alert, Linking } from "react-native";

/**
 * Opens a web page, store page or mail link outside the app. When nothing can handle it
 * (no browser / mail app), shows the address so the member can open it themselves.
 */
export function openExternalUrl(url: string, fallbackTitle: string, fallbackMessage?: string) {
  void Linking.openURL(url).catch(() =>
    Alert.alert(fallbackTitle, fallbackMessage ?? `Open ${url} in your browser.`),
  );
}
