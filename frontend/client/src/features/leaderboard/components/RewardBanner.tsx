import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

import { timeLeftLabel } from "../model";

type RewardBannerProps = {
  weekEndsAt: string;
  /** Set while you enjoy last week's reward. */
  rewardProUntil: string | null;
};

/** The weekly prize, or your active reward when you won last week. */
export const RewardBanner = memo(function RewardBanner({
  weekEndsAt,
  rewardProUntil,
}: RewardBannerProps) {
  const won = rewardProUntil !== null;

  return (
    <LinearGradient
      colors={won ? ["#22C55E", "#0EA5E9"] : ["#F59E0B", "#C2410C"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={won ? "gift" : "trophy"} size={26} color="#FFFFFF" />
      </View>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{won ? "AI CÂȘTIGAT" : "PREMIUL SĂPTĂMÂNII"}</Text>
        <Text style={styles.title}>
          {won
            ? "Ai Sayly Pro gratuit pentru că ai fost pe locul 1!"
            : "Ocupă locul 1 până duminică și câștigi 1 zi de Sayly Pro gratuit!"}
        </Text>
        <Text style={styles.body}>
          {won
            ? `Activ până ${new Date(rewardProUntil).toLocaleString()}.`
            : `Clasamentul se închide în ${timeLeftLabel(weekEndsAt)}.`}
        </Text>
      </View>
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 23,
  },
  body: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    lineHeight: 18,
  },
});
