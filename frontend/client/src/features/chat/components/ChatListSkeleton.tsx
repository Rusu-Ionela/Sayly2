import { StyleSheet, View } from "react-native";

import { Skeleton } from "@/shared/components/Skeleton";
import { useColors } from "@/shared/theme";

import { CHAT_LIST_AVATAR_SIZE, CHAT_LIST_ROW_HEIGHT } from "../constants";

export function ChatListSkeleton({ rows = 8 }: { rows?: number }) {
  const colors = useColors();

  return (
    <View accessibilityLabel="Loading conversations" accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={[styles.row, { borderBottomColor: colors.border }]}>
          <Skeleton
            width={CHAT_LIST_AVATAR_SIZE}
            height={CHAT_LIST_AVATAR_SIZE}
            radius={CHAT_LIST_AVATAR_SIZE / 2}
          />
          <View style={styles.body}>
            <Skeleton width="45%" height={14} />
            <Skeleton width="80%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    height: CHAT_LIST_ROW_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, gap: 10 },
});
