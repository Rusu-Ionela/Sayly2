import { navigateInApp } from "@/navigation/navigationRef";

import type { NotificationTarget } from "./rules";

export function openNotificationTarget(target: NotificationTarget) {
  if (target.screen === "PublicProfile") {
    navigateInApp("PublicProfile", { userId: target.userId });
    return;
  }
  navigateInApp("Conversation", { conversationId: target.conversationId });
}
