import type { IconName } from "@/shared/components/SettingRow";

import type { InboxItem } from "./api";
import type { NotificationTarget } from "./rules";

export type InboxRow = { icon: IconName; text: string; target: NotificationTarget };

/** How one inbox item reads in the list and where tapping it leads. */
export function inboxRow(item: InboxItem): InboxRow {
  const name = item.actor.displayName.trim() || "Someone";
  const profile: NotificationTarget = { screen: "PublicProfile", userId: item.actor.id };

  switch (item.type) {
    case "CORRECTION":
      return {
        icon: "create-outline",
        text: `${name} suggested a correction`,
        target: item.conversationId
          ? { screen: "Conversation", conversationId: item.conversationId }
          : profile,
      };
    case "REFERENCE":
      return { icon: "ribbon-outline", text: `${name} wrote a reference for you`, target: profile };
  }
}
