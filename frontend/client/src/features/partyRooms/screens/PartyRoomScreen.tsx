import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  PARTY_REACTION_EMOJI,
  PARTY_REACTIONS,
  type PartyParticipantDto,
  type PartyReaction,
} from "@sayly/shared";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth";
import { useCall } from "@/features/calls/CallContext";
import type { AppStackParamList } from "@/navigation/types";
import { ActionSheet } from "@/shared/components/ActionSheet";
import { PressableScale } from "@/shared/components/PressableScale";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";
import { confirmAction } from "@/shared/utils/confirmAction";

import { FloatingReactions } from "../components/FloatingReactions";
import { ParticipantTile } from "../components/ParticipantTile";
import { usePartyRoom, type PartyPhase } from "../hooks/usePartyRoom";
import { raisedHands } from "../model/partyModel";

function showError(error: unknown) {
  Alert.alert("Something went wrong", error instanceof Error ? error.message : "Please try again.");
}

function endedCopy(phase: Extract<PartyPhase, { kind: "ended" }>) {
  switch (phase.reason) {
    case "host_ended":
      return {
        title: "The host ended the room",
        body: "Thanks for joining! Start your own room any time.",
      };
    case "host_left":
      return {
        title: "The room has closed",
        body: "The host left and nobody was on stage to take over.",
      };
    case "removed":
      return {
        title: "You left the room",
        body: "The host removed you, or you joined from another device.",
      };
    case "left":
      return { title: "You left the room", body: undefined };
    default:
      return { title: "The room has ended", body: undefined };
  }
}

function ControlButton({
  icon,
  label,
  onPress,
  active,
  danger,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  const colors = useColors();
  const background = danger ? colors.error : active ? colors.accent : colors.accentSoft;
  const foreground = danger || active ? colors.onPrimary : colors.accent;
  return (
    <PressableScale
      onPress={onPress}
      style={styles.control}
      scaleTo={0.92}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active === undefined ? undefined : { selected: active }}
    >
      <View style={[styles.controlIcon, { backgroundColor: background }]}>
        <Ionicons name={icon} size={22} color={foreground} />
      </View>
      <Text style={[styles.controlLabel, { color: colors.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const AUDIO_UNSUPPORTED_MESSAGE =
  "Room audio needs the installed Sayly app. In Expo Go or on the web you can follow along and react, without sound.";

function useClose() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  return () =>
    navigation.canGoBack()
      ? navigation.goBack()
      : navigation.navigate("MainTabs", { screen: "Groups" });
}

/** A 1:1 call holds the microphone, so the room only opens once it is over. */
export function PartyRoomScreen() {
  const route = useRoute<RouteProp<AppStackParamList, "PartyRoom">>();
  const colors = useColors();
  const close = useClose();
  const call = useCall();
  if (call.state.phase !== "idle") {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
        <WarmErrorState
          title="You're on a call"
          body="Finish your call first: a party room needs your microphone too."
          actionLabel="Go back"
          onAction={close}
        />
      </SafeAreaView>
    );
  }
  return <PartyRoomSession roomId={route.params.roomId} />;
}

function PartyRoomSession({ roomId }: { roomId: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const colors = useColors();
  const { userId } = useAuth();
  const close = useClose();
  const { room, phase, self, isHost, reactions, notice, audio, actions } = usePartyRoom(roomId);
  const [target, setTarget] = useState<PartyParticipantDto | null>(null);

  // Leaving the screen leaves the room. The host confirms first, since it hands over or ends it.
  const confirmedRef = useRef(false);
  const hostLiveRef = useRef(false);
  useEffect(() => {
    hostLiveRef.current = isHost && phase.kind === "live";
  }, [isHost, phase.kind]);
  const speakersRef = useRef(0);
  useEffect(() => {
    speakersRef.current = room?.speakers.length ?? 0;
  }, [room]);
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (confirmedRef.current || !hostLiveRef.current) return;
        event.preventDefault();
        confirmAction({
          title: "Leave the room?",
          message:
            speakersRef.current > 1
              ? "The longest-standing speaker becomes the host."
              : "Nobody else is on stage, so the room will end for everyone.",
          confirmLabel: "Leave",
          onConfirm: () => {
            confirmedRef.current = true;
            void actions.leave().then(() => navigation.dispatch(event.data.action));
          },
        });
      }),
    [navigation, actions],
  );
  if (phase.kind === "error" || phase.kind === "ended") {
    const copy =
      phase.kind === "error"
        ? { title: "Could not join the room", body: phase.message }
        : endedCopy(phase);
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
        <WarmErrorState title={copy.title} body={copy.body} actionLabel="Back" onAction={close} />
      </SafeAreaView>
    );
  }
  if (!room || !self) {
    return (
      <SafeAreaView style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Joining room" />
        <Text style={[styles.joining, { color: colors.muted }]}>Joining…</Text>
      </SafeAreaView>
    );
  }

  const speaking = self.role !== "LISTENER";
  const hands = raisedHands(room);
  const audience = room.listeners;
  const handUp = self.handRaisedAt !== null;
  const run = (task: Promise<unknown>) => void task.catch(showError);

  // For the host, close() goes through the beforeRemove confirmation above.
  const leave = () => {
    if (isHost) {
      close();
      return;
    }
    confirmedRef.current = true;
    void actions.leave().then(close);
  };

  const endRoom = () =>
    confirmAction({
      title: "End the room?",
      message: "Everyone will be disconnected.",
      confirmLabel: "End room",
      onConfirm: () => run(actions.end()),
    });

  const onParticipantPress = (participant: PartyParticipantDto) => {
    if (participant.id === userId && participant.role !== "SPEAKER") return;
    if (participant.id !== userId && !isHost) return;
    setTarget(participant);
  };

  const sheetActions = (() => {
    if (!target) return [];
    if (target.id === userId) {
      return [
        {
          label: "Move to audience",
          icon: "arrow-down-circle-outline" as const,
          onPress: () => run(actions.demote(target.id)),
        },
      ];
    }
    const items = [];
    if (target.role === "LISTENER") {
      items.push({
        label: "Invite to speak",
        icon: "mic-outline" as const,
        tone: "primary" as const,
        onPress: () => run(actions.promote(target.id)),
      });
      if (target.handRaisedAt) {
        items.push({
          label: "Decline request",
          icon: "hand-left-outline" as const,
          onPress: () => run(actions.declineHand(target.id)),
        });
      }
    }
    if (target.role === "SPEAKER") {
      if (!target.muted) {
        items.push({
          label: "Mute",
          icon: "mic-off-outline" as const,
          onPress: () => run(actions.muteUser(target.id)),
        });
      }
      items.push({
        label: "Move to audience",
        icon: "arrow-down-circle-outline" as const,
        onPress: () => run(actions.demote(target.id)),
      });
    }
    items.push({
      label: "Remove from room",
      icon: "remove-circle-outline" as const,
      tone: "danger" as const,
      onPress: () => run(actions.remove(target.id)),
    });
    return items;
  })();

  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: colors.background }]}
      edges={["top", "bottom", "left", "right"]}
    >
      <View style={styles.header}>
        <PressableScale
          onPress={leave}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Leave the room"
        >
          <Ionicons name="chevron-down" size={26} color={colors.text} />
        </PressableScale>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {room.title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {room.flagEmoji ?? "🌐"} {room.languageName} ·{" "}
            {room.speakers.length + room.listeners.length} in the room
          </Text>
        </View>
        <View style={[styles.liveBadge, { backgroundColor: colors.error }]}>
          <Text style={[styles.liveText, { color: colors.onPrimary }]}>LIVE</Text>
        </View>
      </View>

      {!audio.supported ? (
        <Text style={[styles.banner, { backgroundColor: colors.accentSoft, color: colors.accent }]}>
          {AUDIO_UNSUPPORTED_MESSAGE}
        </Text>
      ) : audio.micError ? (
        <Text style={[styles.banner, { backgroundColor: colors.accentSoft, color: colors.error }]}>
          {audio.micError}
        </Text>
      ) : null}
      {notice ? (
        <Text style={[styles.banner, { backgroundColor: colors.accentSoft, color: colors.accent }]}>
          {notice}
        </Text>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.section, { color: colors.label }]}>
          On stage · {room.speakers.length}/{room.maxSpeakers}
        </Text>
        <View style={styles.grid}>
          {room.speakers.map((participant) => (
            <ParticipantTile
              key={participant.id}
              participant={participant}
              size="stage"
              isSelf={participant.id === userId}
              onPress={onParticipantPress}
            />
          ))}
        </View>

        {isHost && hands.length > 0 ? (
          <View
            style={[styles.hands, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          >
            <Text style={[styles.section, { color: colors.label }]}>
              ✋ Raised hands · {hands.length}
            </Text>
            {hands.map((participant) => (
              <View key={participant.id} style={styles.handRow}>
                <Text style={[styles.handName, { color: colors.text }]} numberOfLines={1}>
                  {participant.displayName}
                </Text>
                <PressableScale
                  onPress={() => run(actions.declineHand(participant.id))}
                  style={[styles.decline, { borderColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Decline ${participant.displayName}'s request to speak`}
                >
                  <Text style={[styles.inviteText, { color: colors.muted }]}>Decline</Text>
                </PressableScale>
                <PressableScale
                  onPress={() => run(actions.promote(participant.id))}
                  style={[styles.invite, { backgroundColor: colors.accent }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Invite ${participant.displayName} to speak`}
                >
                  <Text style={[styles.inviteText, { color: colors.onPrimary }]}>
                    Invite to speak
                  </Text>
                </PressableScale>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={[styles.section, { color: colors.label }]}>
          Listening · {audience.length}
          {!isHost && hands.length > 0 ? ` · ${hands.length} ✋` : ""}
        </Text>
        {audience.length === 0 ? (
          <Text style={[styles.empty, { color: colors.muted }]}>Nobody in the audience yet.</Text>
        ) : (
          <View style={styles.grid}>
            {audience.map((participant) => (
              <ParticipantTile
                key={participant.id}
                participant={participant}
                size="audience"
                isSelf={participant.id === userId}
                onPress={onParticipantPress}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <FloatingReactions reactions={reactions} />

      <View style={[styles.reactionBar, { borderTopColor: colors.border }]}>
        {PARTY_REACTIONS.map((kind: PartyReaction) => (
          <PressableScale
            key={kind}
            // Over the rate limit a tap simply does nothing.
            onPress={() => void actions.react(kind).catch(() => undefined)}
            scaleTo={0.85}
            style={[styles.reaction, { backgroundColor: colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel={`Send ${kind.toLowerCase()}`}
          >
            <Text style={styles.reactionEmoji}>{PARTY_REACTION_EMOJI[kind]}</Text>
          </PressableScale>
        ))}
      </View>

      <View style={styles.controls}>
        <ControlButton icon="exit-outline" label="Leave" onPress={leave} />
        {speaking ? (
          <ControlButton
            icon={self.muted ? "mic-off" : "mic"}
            label={self.muted ? "Unmute" : "Mute"}
            active={!self.muted}
            onPress={() => run(actions.setMuted(!self.muted))}
          />
        ) : (
          <ControlButton
            icon="hand-left-outline"
            label={handUp ? "Lower hand" : "Raise hand"}
            active={handUp}
            onPress={() => run(actions.raiseHand(!handUp))}
          />
        )}
        {isHost ? <ControlButton icon="power" label="End room" danger onPress={endRoom} /> : null}
      </View>

      <ActionSheet
        visible={target !== null}
        onClose={() => setTarget(null)}
        title={target ? (target.id === userId ? "You" : target.displayName) : undefined}
        actions={sheetActions.map((item) => ({
          ...item,
          onPress: () => {
            setTarget(null);
            item.onPress();
          },
        }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: spacing.sm },
  joining: { fontSize: 14, fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerBtn: { padding: 4 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: "800" },
  subtitle: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  liveBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  liveText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  banner: {
    marginHorizontal: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.sm,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    overflow: "hidden",
    marginBottom: spacing.xs,
  },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  section: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  empty: { fontSize: 14, fontWeight: "500" },
  hands: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  handRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  handName: { flex: 1, fontSize: 15, fontWeight: "700" },
  invite: {
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  decline: {
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
  },
  inviteText: { fontSize: 13, fontWeight: "700" },
  reactionBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reaction: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionEmoji: { fontSize: 26 },
  controls: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  control: { alignItems: "center", gap: 4, minWidth: 80 },
  controlIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  controlLabel: { fontSize: 12, fontWeight: "700" },
});
