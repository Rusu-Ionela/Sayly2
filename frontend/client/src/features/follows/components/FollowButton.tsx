import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";

type FollowButtonProps = {
  following: boolean;
  onToggle: (next: boolean) => void;
  busy?: boolean;
  name: string;
};

/** "Follow" (filled) / "Following" (outlined) toggle. */
export const FollowButton = memo(function FollowButton({
  following,
  onToggle,
  busy,
  name,
}: FollowButtonProps) {
  const colors = useColors();
  const foreground = following ? colors.accent : colors.onPrimary;

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onToggle(!following);
      }}
      disabled={busy}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        following
          ? { backgroundColor: colors.accentSoft, borderColor: colors.accent }
          : { backgroundColor: colors.accent, borderColor: colors.accent },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: following, busy }}
      accessibilityLabel={following ? `Unfollow ${name}` : `Follow ${name}`}
    >
      {busy ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        <>
          <Ionicons name={following ? "checkmark" : "add"} size={16} color={foreground} />
          <Text style={[styles.label, { color: foreground }]}>
            {following ? "Following" : "Follow"}
          </Text>
        </>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: {
    minWidth: 104,
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.75,
  },
});
