import { useEffect } from "react";
import { Platform } from "react-native";

import { registerSignOutTask } from "@/features/auth";
import { log } from "@/lib/logger";

import { registerPushToken, unregisterPushToken } from "./api";
import { openNotificationTarget } from "./openTarget";
import { pushSupport } from "./pushSupport";
import { targetFromPushData } from "./rules";

type NotificationsModule = typeof import("expo-notifications");

/** Loaded only where push works, so Expo Go on Android never touches the module. */
function loadNotifications(): NotificationsModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-notifications") as NotificationsModule;
}

/**
 * Registers this phone for push notifications while signed in, routes notification taps,
 * and unregisters the phone on sign-out (so the next person on it gets nothing of yours).
 */
export function usePushNotifications() {
  useEffect(() => {
    const support = pushSupport();
    if (!support.supported) {
      log.info("push", "push notifications unavailable", { reason: support.reason });
      return;
    }

    const Notifications = loadNotifications();
    let token: string | null = null;
    let cancelled = false;

    // While the app is open the in-app banner shows instead; keep it in the list only.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    const open = (data: unknown) => {
      const target = targetFromPushData(data);
      if (target) openNotificationTarget(target);
    };

    const tapSubscription = Notifications.addNotificationResponseReceivedListener((response) =>
      open(response.notification.request.content.data),
    );
    // App launched by tapping a notification.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response && !cancelled) open(response.notification.request.content.data);
    });

    const unregisterTask = registerSignOutTask(async () => {
      if (token) await unregisterPushToken(token);
    });

    void (async () => {
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Messages and requests",
            importance: Notifications.AndroidImportance.HIGH,
          });
        }
        const current = await Notifications.getPermissionsAsync();
        const permission = current.granted
          ? current
          : await Notifications.requestPermissionsAsync();
        if (!permission.granted || cancelled) return;

        const result = await Notifications.getExpoPushTokenAsync({
          projectId: support.projectId,
        });
        if (cancelled) return;
        token = result.data;
        await registerPushToken(token, Platform.OS === "ios" ? "ios" : "android");
        log.info("push", "push notifications registered");
      } catch (error) {
        log.warn("push", "push registration failed", {
          message: error instanceof Error ? error.message : "unknown",
        });
      }
    })();

    return () => {
      cancelled = true;
      tapSubscription.remove();
      unregisterTask();
    };
  }, []);
}
