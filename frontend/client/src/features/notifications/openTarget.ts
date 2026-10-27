import { navigateInApp } from "@/navigation/navigationRef";

import type { NotificationTarget } from "./rules";

export function openNotificationTarget(target: NotificationTarget) {
  if (target.screen === "Community") {
    navigateInApp("MainTabs", { screen: "Community" });
    return;
  }
  if (target.screen === "Connections") {
    navigateInApp("Connections");
    return;
  }
  if (target.screen === "PublicProfile") {
    navigateInApp("PublicProfile", { userId: target.userId });
    return;
  }
  navigateInApp("Conversation", { conversationId: target.conversationId });
}
