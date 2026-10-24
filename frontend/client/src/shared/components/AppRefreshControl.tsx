import { RefreshControl, type RefreshControlProps } from "react-native";

import { useColors } from "@/shared/theme";

type AppRefreshControlProps = Omit<
  RefreshControlProps,
  "tintColor" | "colors" | "progressBackgroundColor"
>;

/**
 * Pull-to-refresh with a theme-matched spinner (dark circle, light arc).
 *
 * Every prop must reach the native RefreshControl: on Android, ScrollView/FlatList clone
 * this element and pass the scroll view itself as `children` (plus its `style`). Dropping
 * them renders an empty screen on Android while iOS looks fine.
 */
export function AppRefreshControl(props: AppRefreshControlProps) {
  const colors = useColors();

  return (
    <RefreshControl
      {...props}
      tintColor={colors.text}
      colors={[colors.text]}
      progressBackgroundColor={colors.card}
    />
  );
}
