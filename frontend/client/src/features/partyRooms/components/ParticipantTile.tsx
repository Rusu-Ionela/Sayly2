import { Ionicons } from "@expo/vector-icons";
import type { PartyParticipantDto } from "@sayly/shared";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/shared/components/Avatar";
import { PressableScale } from "@/shared/components/PressableScale";
import { useColors } from "@/shared/theme";

type ParticipantTileProps = {
  participant: PartyParticipantDto;
  size: "stage" | "audience";
  isSelf: boolean;
  onPress?: (participant: PartyParticipantDto) => void;
};

/** A face in the room: big on stage (with mic state), small in the audience (with raised hand). */
export const ParticipantTile = memo(function ParticipantTile({
  participant,
  size,
  isSelf,
  onPress,
}: ParticipantTileProps) {
  const colors = useColors();
  const stage = size === "stage";
  const avatarSize = stage ? 72 : 52;
  const host = participant.role === "HOST";
  const hand = participant.handRaisedAt !== null;
  const name = isSelf ? "You" : participant.displayName;
  const roleLabel = host ? "Host" : participant.role === "SPEAKER" ? "Speaker" : "Listener";

  return (
    <PressableScale
      onPress={() => onPress?.(participant)}
      disabled={!onPress}
      style={[styles.tile, { width: stage ? 96 : 76 }]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${name}, ${roleLabel}${stage && participant.muted ? ", muted" : ""}${hand ? ", hand raised" : ""}`}
    >
      <View>
        <View
          style={[
            styles.ring,
            {
              borderColor: stage && !participant.muted ? colors.accent : "transparent",
              borderRadius: avatarSize,
            },
          ]}
        >
          <Avatar uri={participant.avatarUrl} name={participant.displayName} size={avatarSize} />
        </View>
        {stage && participant.muted ? (
          <View
            style={[
              styles.badge,
              styles.badgeRight,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons name="mic-off" size={13} color={colors.muted} />
          </View>
        ) : null}
        {host ? (
          <View
            style={[
              styles.badge,
              styles.badgeLeft,
              { backgroundColor: colors.pro, borderColor: colors.card },
            ]}
          >
            <Ionicons name="star" size={12} color={colors.white} />
          </View>
        ) : null}
        {hand ? (
          <View
            style={[
              styles.badge,
              styles.badgeRight,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={styles.hand}>✋</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {name}
      </Text>
      {stage ? <Text style={[styles.role, { color: colors.muted }]}>{roleLabel}</Text> : null}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  tile: { alignItems: "center", gap: 4, paddingVertical: 4 },
  ring: { borderWidth: 3, padding: 2 },
  badge: {
    position: "absolute",
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeRight: { right: -2 },
  badgeLeft: { left: -2 },
  hand: { fontSize: 13 },
  name: { fontSize: 13, fontWeight: "700", maxWidth: "100%" },
  role: { fontSize: 11, fontWeight: "600" },
});
