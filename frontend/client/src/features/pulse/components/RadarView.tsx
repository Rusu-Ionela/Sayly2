import { Ionicons } from "@expo/vector-icons";
import type { RadarPartnerDto } from "@sayly/shared";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useRequestConnection } from "@/features/connections";
import { useProfile } from "@/features/profile";
import { Avatar } from "@/shared/components/Avatar";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { useRadar } from "../hooks";
import { lastActiveLabel, layoutRadar, RING_FRACTIONS } from "../model";
import { pulsePalette } from "../palette";
import { PulseHalo } from "./PulseHalo";

const DOT_SIZE = 46;
const MAX_RADAR = 360;

type RadarViewProps = {
  bottomPadding: number;
  onOpenProfile: (userId: string) => void;
  onOpenChat: (conversationId: string) => void;
  onStartQuest: () => void;
};

type RequestState = "sending" | "PENDING" | "ACCEPTED";

function Sweep({ size }: { size: number }) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    turn.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [reduceMotion, turn]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  if (reduceMotion) return null;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, style]}>
      <View style={{ width: size, height: size }}>
        <LinearGradient
          colors={[`${pulsePalette.neon}00`, `${pulsePalette.neon}88`]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.beam, { left: size / 2, top: size / 2 - 1, width: size / 2 }]}
        />
      </View>
    </Animated.View>
  );
}

/** Immersive "who is around right now" view: rings by language fit, live members pulse. */
export function RadarView({
  bottomPadding,
  onOpenProfile,
  onOpenChat,
  onStartQuest,
}: RadarViewProps) {
  const colors = useColors();
  const radar = useRadar(true);
  const profile = useProfile();
  const connect = useRequestConnection();
  const [width, setWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requests, setRequests] = useState<Record<string, RequestState>>({});

  const size = Math.min(width, MAX_RADAR);
  const radius = size / 2 - DOT_SIZE / 2 - 4;
  const partners = useMemo(() => radar.data?.items ?? [], [radar.data]);
  const dots = useMemo(() => (radius > 0 ? layoutRadar(partners, radius) : []), [partners, radius]);
  const selected = partners.find((partner) => partner.id === selectedId) ?? null;

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const select = (partner: RadarPartnerDto) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setSelectedId((current) => (current === partner.id ? null : partner.id));
  };

  /** One tap: a connection request goes out (or is accepted if they already asked). */
  const connectWith = (partner: RadarPartnerDto) => {
    if (requests[partner.id]) return;
    setRequests((current) => ({ ...current, [partner.id]: "sending" }));
    connect.mutate(
      { userId: partner.id },
      {
        onSuccess: (connection) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
            () => undefined,
          );
          setRequests((current) => ({
            ...current,
            [partner.id]: connection.status === "ACCEPTED" ? "ACCEPTED" : "PENDING",
          }));
        },
        onError: () =>
          setRequests((current) => {
            const next = { ...current };
            delete next[partner.id];
            return next;
          }),
      },
    );
  };

  const onlineCount = radar.data?.onlineCount ?? 0;

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[pulsePalette.deepEdge, pulsePalette.deep]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.panel}
      >
        <View style={styles.header}>
          <View style={[styles.liveDot, { backgroundColor: pulsePalette.online }]} />
          <Text style={styles.headerText}>
            {radar.isPending
              ? "Scanning…"
              : `${onlineCount} online · ${partners.length} active in the last 15 min`}
          </Text>
          {radar.isFetching && !radar.isPending ? (
            <ActivityIndicator size="small" color={pulsePalette.neon} />
          ) : null}
        </View>

        <View onLayout={onLayout} style={styles.stageWrap}>
          {size > 0 ? (
            <View style={{ width: size, height: size }}>
              {([2, 1, 0] as const).map((ring) => {
                const diameter = 2 * radius * RING_FRACTIONS[ring] + DOT_SIZE * 0.3;
                return (
                  <View
                    key={ring}
                    pointerEvents="none"
                    style={[
                      styles.ring,
                      {
                        width: diameter,
                        height: diameter,
                        borderRadius: diameter / 2,
                        left: (size - diameter) / 2,
                        top: (size - diameter) / 2,
                        borderColor: ring === 0 ? pulsePalette.ringStrong : pulsePalette.ring,
                      },
                    ]}
                  />
                );
              })}
              <Sweep size={size} />

              <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
                <PulseHalo size={52} color={pulsePalette.neon} />
                <Avatar
                  uri={profile.data?.avatarUrl ?? profile.data?.profileImageUrl}
                  name={profile.data?.displayName}
                  size={52}
                />
              </View>

              {dots.map(({ partner, x, y }, index) => {
                const online = partner.availability === "ONLINE";
                const isSelected = partner.id === selectedId;
                return (
                  <Animated.View
                    key={partner.id}
                    entering={FadeIn.delay(index * 40)}
                    style={[
                      styles.dot,
                      { left: size / 2 + x - DOT_SIZE / 2, top: size / 2 + y - DOT_SIZE / 2 },
                    ]}
                  >
                    <PulseHalo
                      size={DOT_SIZE}
                      color={online ? pulsePalette.online : pulsePalette.neon}
                      active={online}
                      delayMs={(index % 5) * 300}
                    />
                    <Pressable
                      onPress={() => select(partner)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`${partner.displayName}, ${lastActiveLabel(partner)}`}
                      accessibilityState={{ selected: isSelected }}
                      style={[
                        styles.dotRing,
                        {
                          borderColor: isSelected
                            ? pulsePalette.white
                            : online
                              ? pulsePalette.online
                              : pulsePalette.ring,
                          opacity: online || isSelected ? 1 : 0.75,
                        },
                      ]}
                    >
                      <Avatar
                        uri={partner.avatarUrl}
                        name={partner.displayName}
                        size={DOT_SIZE - 6}
                      />
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.legend}>
          <Legend color={pulsePalette.ringStrong} label="Perfect exchange" />
          <Legend color={pulsePalette.ring} label="Good fit" />
          <Legend color={pulsePalette.online} label="Online" />
        </View>
      </LinearGradient>

      {selected ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.selectedCard}>
          <PartnerCard
            partner={selected}
            state={requests[selected.id]}
            onConnect={() => connectWith(selected)}
            onProfile={() => onOpenProfile(selected.id)}
            onChat={
              selected.conversationId ? () => onOpenChat(selected.conversationId ?? "") : undefined
            }
          />
        </Animated.View>
      ) : null}

      {radar.isError && partners.length === 0 ? (
        <Text style={[styles.note, { color: colors.muted }]}>
          Could not scan right now. Try again in a moment.
        </Text>
      ) : !radar.isPending && partners.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>It’s quiet right now</Text>
          <Text style={[styles.note, { color: colors.muted }]}>
            Start a 3-minute Flash Quest and we’ll pair you with the next person who joins.
          </Text>
          <Pressable onPress={onStartQuest} style={styles.questButton} accessibilityRole="button">
            <Text style={styles.questButtonText}>⚡ Start a Flash Quest</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {partners.map((partner) =>
            partner.id === selectedId ? null : (
              <PartnerCard
                key={partner.id}
                compact
                partner={partner}
                state={requests[partner.id]}
                onConnect={() => connectWith(partner)}
                onProfile={() => onOpenProfile(partner.id)}
                onChat={
                  partner.conversationId
                    ? () => onOpenChat(partner.conversationId ?? "")
                    : undefined
                }
              />
            ),
          )}
        </View>
      )}
    </ScrollView>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { borderColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

type PartnerCardProps = {
  partner: RadarPartnerDto;
  state: RequestState | undefined;
  compact?: boolean;
  onConnect: () => void;
  onProfile: () => void;
  onChat?: () => void;
};

function PartnerCard({ partner, state, compact, onConnect, onProfile, onChat }: PartnerCardProps) {
  const online = partner.availability === "ONLINE";
  const teach = partner.canTeach;
  const learn = partner.wantsToLearn;
  const exchange = [
    teach ? `${teach.flagEmoji ?? ""} teaches ${teach.name}`.trim() : null,
    learn ? `${learn.flagEmoji ?? ""} learns ${learn.name}`.trim() : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const action = onChat ? (
    <ActionButton icon="chatbubble-ellipses" label="Chat" onPress={onChat} />
  ) : state === "ACCEPTED" ? (
    <ActionButton icon="checkmark-circle" label="Connected" disabled />
  ) : state === "PENDING" ? (
    <ActionButton icon="paper-plane" label="Sent" disabled />
  ) : (
    <ActionButton
      icon="flash"
      label="Connect"
      busy={state === "sending"}
      onPress={onConnect}
      primary
    />
  );

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <Pressable
        onPress={onProfile}
        style={styles.cardMain}
        accessibilityRole="button"
        accessibilityLabel={`Open ${partner.displayName}'s profile`}
      >
        <View>
          <Avatar uri={partner.avatarUrl} name={partner.displayName} size={compact ? 44 : 56} />
          {online ? (
            <View style={[styles.presence, { backgroundColor: pulsePalette.online }]} />
          ) : null}
        </View>
        <View style={styles.cardText}>
          <Text style={styles.name} numberOfLines={1}>
            {partner.displayName}
            {partner.country ? <Text style={styles.country}>{`  ${partner.country}`}</Text> : null}
          </Text>
          <Text style={[styles.meta, online && { color: pulsePalette.online }]}>
            {lastActiveLabel(partner)}
          </Text>
          {exchange ? (
            <Text style={styles.exchange} numberOfLines={1}>
              {exchange}
            </Text>
          ) : null}
          {!compact && partner.matchReason ? (
            <Text style={styles.reason}>{partner.matchReason}</Text>
          ) : null}
        </View>
      </Pressable>
      {action}
    </View>
  );
}

type ActionButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  busy?: boolean;
  primary?: boolean;
};

function ActionButton({ icon, label, onPress, disabled, busy, primary }: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      style={({ pressed }) => [
        styles.action,
        primary ? { backgroundColor: pulsePalette.glow } : { backgroundColor: pulsePalette.glass },
        pressed && { opacity: 0.8 },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={pulsePalette.white} />
      ) : (
        <>
          <Ionicons
            name={icon}
            size={15}
            color={primary ? pulsePalette.white : pulsePalette.neon}
          />
          <Text
            style={[styles.actionText, { color: primary ? pulsePalette.white : pulsePalette.text }]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 28,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: pulsePalette.glassBorder,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.sm,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  headerText: {
    flex: 1,
    color: pulsePalette.muted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  stageWrap: { alignItems: "center", paddingVertical: spacing.sm },
  center: { alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderWidth: 1 },
  beam: { position: "absolute", height: 2, borderRadius: 1 },
  dot: {
    position: "absolute",
    width: DOT_SIZE,
    height: DOT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  dotRing: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: pulsePalette.deep,
  },
  legend: { flexDirection: "row", justifyContent: "center", gap: spacing.md, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  legendText: { color: pulsePalette.muted, fontSize: 12, fontWeight: "600" },
  selectedCard: { marginTop: spacing.md },
  list: { marginTop: spacing.md, gap: spacing.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 22,
    backgroundColor: pulsePalette.deep,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: pulsePalette.ringStrong,
  },
  cardCompact: { padding: 12, borderColor: pulsePalette.glassBorder },
  cardMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cardText: { flex: 1, gap: 2 },
  presence: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: pulsePalette.deep,
  },
  name: { color: pulsePalette.text, fontSize: 16, fontWeight: "800" },
  country: { color: pulsePalette.muted, fontSize: 13, fontWeight: "600" },
  meta: { color: pulsePalette.muted, fontSize: 12, fontWeight: "700" },
  exchange: { color: pulsePalette.neon, fontSize: 13, fontWeight: "600" },
  reason: { color: pulsePalette.muted, fontSize: 13, marginTop: 4 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    minWidth: 96,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  actionText: { fontSize: 14, fontWeight: "800" },
  empty: {
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  emptyTitle: { color: pulsePalette.text, fontSize: 18, fontWeight: "800" },
  note: { color: pulsePalette.muted, fontSize: 14, textAlign: "center", marginTop: spacing.md },
  questButton: {
    marginTop: spacing.sm,
    backgroundColor: pulsePalette.glow,
    paddingHorizontal: 20,
    minHeight: 48,
    borderRadius: 24,
    justifyContent: "center",
  },
  questButtonText: { color: pulsePalette.white, fontSize: 15, fontWeight: "800" },
});
