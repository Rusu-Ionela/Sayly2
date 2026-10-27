import { Ionicons } from "@expo/vector-icons";
import type { PartyRoomSummaryDto } from "@sayly/shared";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/shared/components/Avatar";
import { PressableScale } from "@/shared/components/PressableScale";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

export const PartyRoomCard = memo(function PartyRoomCard({
  room,
  onOpen,
}: {
  room: PartyRoomSummaryDto;
  onOpen: (room: PartyRoomSummaryDto) => void;
}) {
  const colors = useColors();
  const faces = [room.host, ...room.speakers];
  return (
    <PressableScale
      onPress={() => onOpen(room)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
      accessibilityRole="button"
      accessibilityLabel={`${room.title}, hosted by ${room.host.displayName}, ${room.participantCount} in the room. Join`}
    >
      <View style={styles.top}>
        <View style={[styles.live, { backgroundColor: colors.error }]}>
          <Text style={[styles.liveText, { color: colors.onPrimary }]}>LIVE</Text>
        </View>
        <Text style={[styles.language, { color: colors.muted }]}>
          {room.flagEmoji ?? "🌐"} {room.languageName}
        </Text>
      </View>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {room.title}
      </Text>
      <View style={styles.bottom}>
        <View style={styles.faces}>
          {faces.slice(0, 4).map((person, index) => (
            <View
              key={person.id}
              style={[styles.face, index > 0 && styles.overlap, { borderColor: colors.card }]}
            >
              <Avatar uri={person.avatarUrl} name={person.displayName} size={28} />
            </View>
          ))}
        </View>
        <Text style={[styles.host, { color: colors.muted }]} numberOfLines={1}>
          {room.host.displayName}
          {room.speakers.length ? ` + ${room.speakers.length} on stage` : ""}
        </Text>
        <View style={styles.count}>
          <Ionicons name="headset-outline" size={15} color={colors.muted} />
          <Text style={[styles.countText, { color: colors.muted }]}>{room.participantCount}</Text>
        </View>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, gap: 8 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  live: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
  liveText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  language: { fontSize: 13, fontWeight: "600" },
  title: { fontSize: 17, fontWeight: "800" },
  bottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  faces: { flexDirection: "row" },
  face: { borderWidth: 2, borderRadius: 16 },
  overlap: { marginLeft: -10 },
  host: { flex: 1, fontSize: 13, fontWeight: "600" },
  count: { flexDirection: "row", alignItems: "center", gap: 3 },
  countText: { fontSize: 13, fontWeight: "700" },
});
