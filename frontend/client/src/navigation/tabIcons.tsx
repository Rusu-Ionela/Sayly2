import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { useColors } from "@/shared/theme";

export function ionicon(
  focusedName: keyof typeof Ionicons.glyphMap,
  idleName: keyof typeof Ionicons.glyphMap,
) {
  function TabIcon({ color, size, focused }: { color: string; size: number; focused: boolean }) {
    return (
      <IoniconMark
        color={color}
        size={size}
        focused={focused}
        focusedName={focusedName}
        idleName={idleName}
      />
    );
  }
  TabIcon.displayName = `TabIcon(${String(focusedName)})`;
  return TabIcon;
}

function IoniconMark({
  color,
  size,
  focused,
  focusedName,
  idleName,
}: {
  color: string;
  size: number;
  focused: boolean;
  focusedName: keyof typeof Ionicons.glyphMap;
  idleName: keyof typeof Ionicons.glyphMap;
}) {
  const colors = useColors();
  return (
    <View style={[styles.iconWrap, focused && { backgroundColor: colors.accent }]}>
      <Ionicons
        name={focused ? focusedName : idleName}
        size={size - 2}
        color={focused ? colors.onPrimary : color}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 52,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
  },
});
