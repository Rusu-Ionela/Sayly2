import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/shared/components/Avatar";

import { useCall } from "./CallContext";
import { getWebRtc } from "./webrtc";

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function RoundButton({
  icon,
  label,
  onPress,
  tone = "neutral",
  active = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: "neutral" | "danger" | "success";
  active?: boolean;
}) {
  const background =
    tone === "danger"
      ? "#E5484D"
      : tone === "success"
        ? "#30A46C"
        : active
          ? "#FFFFFF"
          : "rgba(255,255,255,0.18)";
  const color = tone === "neutral" && active ? "#111111" : "#FFFFFF";
  return (
    <Pressable
      onPress={onPress}
      style={[styles.round, { backgroundColor: background }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={28} color={color} />
    </Pressable>
  );
}

/** Full-screen call UI. Renders nothing while idle, except a brief "Call ended" style notice. */
export function CallScreen() {
  const { state, localStream, remoteStream, accept, hangUp, toggleMute, toggleCamera, flipCamera } =
    useCall();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (state.phase !== "active") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.phase]);

  if (state.phase === "idle") {
    return state.notice ? (
      <View style={[styles.noticeWrap, { top: insets.top + 12 }]} pointerEvents="none">
        <Text style={styles.noticeText}>{state.notice}</Text>
      </View>
    ) : null;
  }

  const RTCView = getWebRtc()?.RTCView;
  const video = state.kind === "VIDEO";
  const showRemoteVideo = video && state.phase === "active" && remoteStream && RTCView;
  const peerName = state.peer?.displayName ?? "";

  const status =
    state.phase === "outgoing"
      ? "Calling…"
      : state.phase === "incoming"
        ? `Incoming ${video ? "video" : "audio"} call`
        : state.phase === "connecting"
          ? "Connecting…"
          : formatElapsed(now - (state.connectedAt ?? now));

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={hangUp}>
      <View style={styles.screen}>
        {showRemoteVideo ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={StyleSheet.absoluteFill}
            objectFit="cover"
          />
        ) : (
          <View style={[styles.center, { paddingTop: insets.top + 80 }]}>
            <Avatar uri={state.peer?.avatarUrl} name={peerName} size={140} />
            <Text style={styles.name}>{peerName}</Text>
            <Text style={styles.status} accessibilityLiveRegion="polite">
              {status}
            </Text>
          </View>
        )}

        {showRemoteVideo ? (
          <View style={[styles.topBar, { top: insets.top + 12 }]}>
            <Text style={styles.nameSmall}>{peerName}</Text>
            <Text style={styles.statusSmall}>{status}</Text>
          </View>
        ) : null}

        {video && localStream && RTCView && !state.cameraOff ? (
          <RTCView
            streamURL={localStream.toURL()}
            style={[styles.pip, { top: insets.top + 12 }]}
            objectFit="cover"
            mirror
            zOrder={1}
          />
        ) : null}

        <View style={[styles.controls, { paddingBottom: insets.bottom + 28 }]}>
          {state.phase === "incoming" ? (
            <>
              <RoundButton icon="close" label="Decline call" tone="danger" onPress={hangUp} />
              <RoundButton
                icon={video ? "videocam" : "call"}
                label="Accept call"
                tone="success"
                onPress={() => void accept()}
              />
            </>
          ) : (
            <>
              <RoundButton
                icon={state.muted ? "mic-off" : "mic"}
                label={state.muted ? "Unmute" : "Mute"}
                active={state.muted}
                onPress={toggleMute}
              />
              {video ? (
                <RoundButton
                  icon={state.cameraOff ? "videocam-off" : "videocam"}
                  label={state.cameraOff ? "Turn camera on" : "Turn camera off"}
                  active={state.cameraOff}
                  onPress={toggleCamera}
                />
              ) : null}
              {video ? (
                <RoundButton icon="camera-reverse" label="Flip camera" onPress={flipCamera} />
              ) : null}
              <RoundButton icon="call" label="End call" tone="danger" onPress={hangUp} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0B0D" },
  center: { flex: 1, alignItems: "center", gap: 12 },
  name: { color: "#FFFFFF", fontSize: 28, fontWeight: "700", marginTop: 12 },
  status: { color: "rgba(255,255,255,0.7)", fontSize: 17 },
  topBar: { position: "absolute", left: 20, gap: 2 },
  nameSmall: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  statusSmall: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  pip: {
    position: "absolute",
    right: 16,
    width: 110,
    height: 160,
    borderRadius: 14,
    overflow: "hidden",
  },
  controls: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 22,
  },
  round: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  noticeWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  noticeText: {
    color: "#FFFFFF",
    backgroundColor: "rgba(20,20,22,0.92)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    overflow: "hidden",
    fontSize: 15,
    fontWeight: "600",
  },
});
