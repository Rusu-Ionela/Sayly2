import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { SlideInUp, SlideOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { IconName } from "@/shared/components/SettingRow";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

export type Banner = {
  /** Same key replaces the visible banner instead of stacking (e.g. one chat). */
  key: string;
  icon: IconName;
  title: string;
  body: string;
  onPress?: () => void;
};

type BannerContextValue = { show: (banner: Banner) => void };

const BannerContext = createContext<BannerContextValue>({ show: () => undefined });

const VISIBLE_MS = 4_500;

/** In-app notification banners (new request, new message) shown over every screen. */
export function InAppBannerProvider({ children }: { children: ReactNode }) {
  const [banner, setBanner] = useState<Banner | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setBanner(null);
  }, []);

  const show = useCallback(
    (next: Banner) => {
      if (timer.current) clearTimeout(timer.current);
      setBanner(next);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      timer.current = setTimeout(hide, VISIBLE_MS);
    },
    [hide],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <BannerContext.Provider value={value}>
      {children}
      {banner ? <BannerCard key={banner.key} banner={banner} onClose={hide} /> : null}
    </BannerContext.Provider>
  );
}

export function useInAppBanner() {
  return useContext(BannerContext);
}

function BannerCard({ banner, onClose }: { banner: Banner; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      entering={SlideInUp.duration(260)}
      exiting={SlideOutUp.duration(200)}
      style={[styles.wrap, { top: insets.top + spacing.xs }]}
      pointerEvents="box-none"
    >
      {/* Open and Dismiss are siblings: a button inside a button is invalid on web. */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            shadowColor: colors.shadow,
          },
        ]}
        accessibilityLiveRegion="polite"
      >
        <Pressable
          onPress={() => {
            onClose();
            banner.onPress?.();
          }}
          style={({ pressed }) => [styles.open, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${banner.title}. ${banner.body}`}
        >
          <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name={banner.icon} size={20} color={colors.accent} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {banner.title}
            </Text>
            <Text style={[styles.body, { color: colors.muted }]} numberOfLines={2}>
              {banner.body}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Ionicons name="close" size={18} color={colors.muted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    zIndex: 1000,
    elevation: 1000,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 8,
  },
  open: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
});
