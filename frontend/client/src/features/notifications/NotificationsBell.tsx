import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";

import type { AppStackParamList } from "@/navigation/types";
import { PressableScale } from "@/shared/components/PressableScale";
import { useColors } from "@/shared/theme";

import { useUnreadCount } from "./useInbox";
import { badgeLabel } from "./useNotificationBadges";

/** Header bell that opens the inbox; the badge shows unread items. */
export function NotificationsBell() {
  const colors = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const unread = badgeLabel(useUnreadCount().data ?? 0);

  return (
    <PressableScale
      onPress={() => navigation.navigate("Notifications")}
      hitSlop={10}
      style={[styles.button, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.text} />
      {unread ? (
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{unread}</Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
});
