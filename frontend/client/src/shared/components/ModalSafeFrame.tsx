import { type ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/shared/theme";
import { SafeView } from "@/shared/utils/withoutTextNodes";

type ModalSafeFrameProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Array<"top" | "bottom">;
};

/** Safe-area padding for full-screen modals (SafeAreaView is unreliable inside Modal). */
export function ModalSafeFrame({
  children,
  style,
  edges = ["top", "bottom"],
}: ModalSafeFrameProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <SafeView
      style={[
        {
          flex: 1,
          paddingTop: edges.includes("top") ? insets.top : 0,
          paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
          backgroundColor: colors.background,
        },
        style,
      ]}
    >
      {children}
    </SafeView>
  );
}
