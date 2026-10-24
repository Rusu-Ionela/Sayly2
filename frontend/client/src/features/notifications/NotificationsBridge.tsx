import { usePushNotifications } from "./usePushNotifications";
import { useRealtimeNotifications } from "./useRealtimeNotifications";

/** Mounted once inside the signed-in app: in-app banners + push registration. */
export function NotificationsBridge() {
  useRealtimeNotifications();
  usePushNotifications();
  return null;
}
