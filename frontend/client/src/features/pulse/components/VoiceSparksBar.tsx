import { Ionicons } from "@expo/vector-icons";
import type { VoiceSparkDto } from "@sayly/shared";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { usePracticeLanguages } from "@/features/icebreakers/hooks";
import { useProfile } from "@/features/profile";
import { Avatar } from "@/shared/components/Avatar";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { useVoiceSparks } from "../hooks";
import { pulsePalette, sparkGradient } from "../palette";
import { type SparkSheetState, VoiceSparkSheet } from "./VoiceSparkSheet";

const BUBBLE = 62;

type BubbleProps = {
  name: string;
  avatarUrl: string | null | undefined;
  label: string;
  heard: boolean;
  flag?: string | null;
  badge?: number;
  addIcon?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
};

function SparkBubble({
  name,
  avatarUrl,
  label,
  heard,
  flag,
  badge,
  addIcon,
  onPress,
  accessibilityLabel,
}: BubbleProps) {
  const colors = useColors();
  const ring = heard ? [colors.trail, colors.trail] : [...sparkGradient];
  return (
    <Pressable
      onPress={onPress}
      style={styles.bubble}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <LinearGradient
        colors={ring as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ring}
      >
        <View style={[styles.ringInner, { backgroundColor: colors.background }]}>
          <Avatar uri={avatarUrl} name={name} size={BUBBLE - 8} />
        </View>
      </LinearGradient>
      {flag ? <Text style={styles.flag}>{flag}</Text> : null}
      {addIcon ? (
        <View
          style={[
            styles.add,
            { backgroundColor: pulsePalette.glow, borderColor: colors.background },
          ]}
        >
          <Ionicons name="mic" size={12} color={pulsePalette.white} />
        </View>
      ) : null}
      {badge ? (
        <View style={[styles.badge, { borderColor: colors.background }]}>
          <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      ) : null}
      <Text style={[styles.label, { color: heard ? colors.muted : colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Horizontal carousel of 15-second Voice Sparks at the top of Community. */
export function VoiceSparksBar() {
  const feed = useVoiceSparks();
  const profile = useProfile();
  const languages = usePracticeLanguages();
  const [heard, setHeard] = useState<ReadonlySet<string>>(new Set());
  const [sheet, setSheet] = useState<SparkSheetState | null>(null);

  const markHeard = useCallback((sparkId: string) => {
    setHeard((current) => (current.has(sparkId) ? current : new Set([...current, sparkId])));
  }, []);

  const mine = feed.data?.mine ?? null;
  const items = feed.data?.items ?? [];
  const replies = feed.data?.replies ?? [];
  const unheardReplies = replies.filter((reply) => !heard.has(reply.id)).length;

  const openMine = () => {
    const queue: VoiceSparkDto[] = mine ? [mine, ...replies] : replies;
    setSheet({ queue, index: 0, ownerView: true });
  };

  const me = profile.data;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        style={styles.scroll}
      >
        <SparkBubble
          name={me?.displayName ?? "You"}
          avatarUrl={me?.avatarUrl ?? me?.profileImageUrl}
          label={mine ? "Your spark" : "Add spark"}
          heard={!mine && unheardReplies === 0}
          addIcon={!mine}
          badge={unheardReplies}
          onPress={openMine}
          accessibilityLabel={
            mine
              ? `Your Voice Spark${unheardReplies ? `, ${unheardReplies} new voice replies` : ""}`
              : "Record a Voice Spark"
          }
        />
        {items.map((spark, index) => (
          <SparkBubble
            key={spark.id}
            name={spark.author.displayName}
            avatarUrl={spark.author.avatarUrl}
            label={spark.author.displayName.split(" ")[0] ?? spark.author.displayName}
            flag={spark.flagEmoji}
            heard={heard.has(spark.id)}
            onPress={() => setSheet({ queue: items, index, ownerView: false })}
            accessibilityLabel={`Play ${spark.author.displayName}'s Voice Spark in ${spark.languageName}`}
          />
        ))}
      </ScrollView>

      <VoiceSparkSheet
        state={sheet}
        viewerId={me?.id}
        languages={languages}
        onPlayed={markHeard}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0, marginBottom: spacing.sm },
  row: { gap: 14, paddingRight: spacing.md, paddingVertical: 4 },
  bubble: { width: BUBBLE + 6, alignItems: "center" },
  ring: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    padding: 2.5,
  },
  ringInner: {
    flex: 1,
    borderRadius: BUBBLE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  flag: { position: "absolute", top: BUBBLE - 20, left: 0, fontSize: 16 },
  add: {
    position: "absolute",
    top: BUBBLE - 22,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    borderWidth: 2,
    backgroundColor: pulsePalette.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: pulsePalette.white, fontSize: 10, fontWeight: "800" },
  label: { marginTop: 4, fontSize: 12, fontWeight: "700", maxWidth: BUBBLE + 6 },
});
