import { HeaderHeightContext } from "@react-navigation/elements";
import { useContext, type ReactNode } from "react";
import { type Edge } from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-safe-area-context";

import { SafeView } from "@/shared/utils/withoutTextNodes";

type ScreenProps = {
  children: ReactNode;
  padded?: boolean;
  /** Include bottom safe-area inset — use on stack screens without a tab bar. */
  includeBottomInset?: boolean;
};

export function Screen({ children, padded = true, includeBottomInset = false }: ScreenProps) {
  // Under a navigation header the header already covers the status bar. On Android
  // (edge-to-edge) adding the top inset again leaves a big empty gap below the header.
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const edges: Edge[] = [
    ...(headerHeight > 0 ? [] : (["top"] as const)),
    ...(includeBottomInset ? (["bottom"] as const) : []),
    "left",
    "right",
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={edges}>
      {/* Cap line length on tablets/desktop web; no effect at phone widths. */}
      <SafeView
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 960,
          alignSelf: "center",
          padding: padded ? 18 : 0,
        }}
      >
        {children}
      </SafeView>
    </SafeAreaView>
  );
}
