import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { PressableScale } from "@/shared/components/PressableScale";
import type { IconName } from "@/shared/components/SettingRow";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

export type PromoCard = {
  key: string;
  icon: IconName;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  gradient: readonly [string, string];
  onPress: () => void;
};

const GAP = spacing.sm;
/** Screen padding of `Screen` on each side. */
const SCREEN_PADDING = 18;

/** Swipeable promo cards (Sayly Pro, certificate) with page dots. */
export const PromoCarousel = memo(function PromoCarousel({ cards }: { cards: PromoCard[] }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const cardWidth = Math.min(width, 960) - SCREEN_PADDING * 2 - (cards.length > 1 ? 28 : 0);

  if (cards.length === 0) return null;

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + GAP));
    if (next !== page) setPage(next);
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + GAP}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={styles.track}
      >
        {cards.map((card) => (
          <LinearGradient
            key={card.key}
            colors={card.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.card, { width: cardWidth }]}
          >
            <View style={styles.eyebrowRow}>
              <Ionicons name={card.icon} size={16} color="#FFFFFF" />
              <Text style={styles.eyebrow}>{card.eyebrow}</Text>
            </View>
            <Text style={styles.title}>{card.title}</Text>
            <Text style={styles.body}>{card.body}</Text>
            <PressableScale
              onPress={card.onPress}
              style={styles.cta}
              accessibilityRole="button"
              accessibilityLabel={card.cta}
            >
              <Text style={[styles.ctaText, { color: card.gradient[1] }]}>{card.cta}</Text>
            </PressableScale>
          </LinearGradient>
        ))}
      </ScrollView>

      {cards.length > 1 ? (
        <View
          style={styles.dots}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {cards.map((card, index) => (
            <View
              key={card.key}
              style={[
                styles.dot,
                { backgroundColor: index === page ? colors.accent : colors.border },
                index === page && styles.dotActive,
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  track: {
    gap: GAP,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eyebrow: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 27,
  },
  body: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    lineHeight: 20,
  },
  cta: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    minHeight: 40,
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: "800",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
  },
});
