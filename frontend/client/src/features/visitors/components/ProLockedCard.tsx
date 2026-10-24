import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/shared/components/PressableScale";
import { ProBadge } from "@/shared/components/ProBadge";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

type ProLockedCardProps = {
  headline: string;
  body: string;
  onUpgrade: () => void;
};

/** Shown instead of a Pro-only list: the count teases, the button explains Pro. */
export function ProLockedCard({ headline, body, onUpgrade }: ProLockedCardProps) {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={[styles.lock, { backgroundColor: colors.proSoft }]}>
        <Ionicons name="lock-closed" size={26} color={colors.pro} />
      </View>
      <ProBadge label="PRO FEATURE" />
      <Text style={[styles.headline, { color: colors.text }]}>{headline}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{body}</Text>
      <PressableScale
        onPress={onUpgrade}
        style={styles.ctaShell}
        accessibilityRole="button"
        accessibilityLabel="Join team Pro"
      >
        <LinearGradient
          colors={["#F59E0B", "#D97706"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cta}
        >
          <Text style={styles.ctaText}>Join team Pro</Text>
        </LinearGradient>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  lock: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  headline: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginTop: spacing.xs,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  ctaShell: {
    alignSelf: "stretch",
    marginTop: spacing.sm,
  },
  cta: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
