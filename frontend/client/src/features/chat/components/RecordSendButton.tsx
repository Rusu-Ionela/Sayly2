import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/shared/theme";

import { VIDEO_NOTE_MARKER } from "../constants";
import type { ChatMediaDraft } from "../types";
import { blobToPlayableAudio, pickRecorderMime } from "../utils/webAudioWav";
import { formatDuration } from "../utils/messagePreview";

const HOLD_MS = 220;
const CANCEL_DX = 72;

type RecordSendButtonProps = {
  disabled?: boolean;
  onSendMedia: (draft: ChatMediaDraft) => void;
};

export function RecordSendButton({ disabled, onSendMedia }: RecordSendButtonProps) {
  const colors = useColors();
  const [mode, setMode] = useState<"voice" | "video">("voice");
  const [recording, setRecording] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [recordMs, setRecordMs] = useState(0);

  const modeRef = useRef(mode);
  const recordingRef = useRef(false);
  const cancellingRef = useRef(false);
  const startedRef = useRef(false);
  const downX = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  modeRef.current = mode;

  const clearHoldTimer = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const clearTick = () => {
    if (tick.current) {
      clearInterval(tick.current);
      tick.current = null;
    }
  };

  const startClock = () => {
    startedAt.current = Date.now();
    setRecordMs(0);
    clearTick();
    tick.current = setInterval(() => setRecordMs(Date.now() - startedAt.current), 200);
  };

  const startVoice = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      Alert.alert("Microphone needed", "Voice recording is not available in this browser.");
      return false;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!recordingRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    streamRef.current = stream;
    chunks.current = [];
    const mime = pickRecorderMime();
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    mediaRecorder.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.current.push(event.data);
    };
    recorder.start();
    startClock();
    startedRef.current = true;
    return true;
  }, []);

  const startVideo = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera needed", "Allow camera access to send a video message.");
      return false;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
      videoMaxDuration: 60,
      quality: 0.8,
    });
    recordingRef.current = false;
    setRecording(false);
    if (result.canceled || !result.assets[0]) {
      return false;
    }
    const asset = result.assets[0];
    onSendMedia({
      type: "VIDEO",
      uri: asset.uri,
      mimeType: asset.mimeType ?? "video/mp4",
      fileName: asset.fileName ?? "video-note.mp4",
      durationMs: asset.duration
        ? Math.round(asset.duration < 1000 ? asset.duration * 1000 : asset.duration)
        : undefined,
      thumbnailUrl: VIDEO_NOTE_MARKER,
    });
    return true;
  }, [onSendMedia]);

  const finish = useCallback(
    async (cancel: boolean) => {
      clearTick();
      recordingRef.current = false;
      setRecording(false);
      setCancelling(false);
      const wasVideo = modeRef.current === "video";
      const didStart = startedRef.current;
      startedRef.current = false;
      const durationMs = Date.now() - startedAt.current;

      if (wasVideo) {
        return;
      }

      const recorder = mediaRecorder.current;
      mediaRecorder.current = null;
      const stream = streamRef.current;
      streamRef.current = null;

      if (!recorder || !didStart) {
        stream?.getTracks().forEach((track) => track.stop());
        return;
      }

      try {
        const blob = await new Promise<Blob>((resolve, reject) => {
          recorder.onstop = () => {
            resolve(new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" }));
          };
          recorder.onerror = () => reject(new Error("record-failed"));
          if (recorder.state !== "inactive") recorder.stop();
          else resolve(new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" }));
        });
        stream?.getTracks().forEach((track) => track.stop());
        if (cancel || blob.size < 1 || durationMs < 600) {
          return;
        }
        const playable = await blobToPlayableAudio(blob);
        onSendMedia({
          type: "VOICE",
          uri: URL.createObjectURL(playable.blob),
          mimeType: playable.mimeType,
          fileName: playable.fileName,
          durationMs,
        });
      } catch {
        stream?.getTracks().forEach((track) => track.stop());
        if (!cancel) {
          Alert.alert("Could not record", "Try again in a moment.");
        }
      }
    },
    [onSendMedia],
  );

  const onGrant = (pageX: number) => {
    if (disabled) return;
    downX.current = pageX;
    cancellingRef.current = false;
    setCancelling(false);
    recordingRef.current = false;
    startedRef.current = false;
    clearHoldTimer();
    holdTimer.current = setTimeout(() => {
      recordingRef.current = true;
      setRecording(true);
      if (modeRef.current === "video") {
        void startVideo();
      } else {
        void startVoice();
      }
    }, HOLD_MS);
  };

  const onMove = (pageX: number) => {
    if (!recordingRef.current && !holdTimer.current) return;
    const cancel = downX.current - pageX > CANCEL_DX;
    if (cancel !== cancellingRef.current) {
      cancellingRef.current = cancel;
      setCancelling(cancel);
    }
  };

  const onRelease = () => {
    const held = recordingRef.current || startedRef.current;
    clearHoldTimer();
    if (!held) {
      setMode((current) => (current === "voice" ? "video" : "voice"));
      return;
    }
    void finish(cancellingRef.current);
  };

  const videoMode = mode === "video";

  return (
    <View>
      {recording ? (
        <View pointerEvents="none" style={styles.hintWrap}>
          <Text style={[styles.hint, { color: cancelling ? colors.rose : colors.muted }]}>
            {cancelling
              ? "Release to delete"
              : `Slide left to cancel · ${formatDuration(recordMs)}`}
          </Text>
        </View>
      ) : videoMode ? (
        <Text pointerEvents="none" style={[styles.modeHint, { color: colors.muted }]}>
          Video message — hold to record
        </Text>
      ) : null}

      <View
        onStartShouldSetResponder={() => !disabled}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => onGrant(event.nativeEvent.pageX)}
        onResponderMove={(event) => onMove(event.nativeEvent.pageX)}
        onResponderRelease={onRelease}
        onResponderTerminate={onRelease}
        accessibilityRole="button"
        accessibilityLabel={
          videoMode
            ? "Tap for voice, hold to record a video message"
            : "Tap for video message, hold to record voice"
        }
        style={[
          styles.button,
          {
            backgroundColor: recording ? (cancelling ? colors.rose : colors.accent) : colors.accent,
            borderRadius: 20,
          },
        ]}
      >
        <Ionicons name={videoMode ? "videocam" : "mic"} size={20} color={colors.white} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hintWrap: {
    position: "absolute",
    right: 56,
    bottom: 10,
    width: 220,
    alignItems: "flex-end",
  },
  hint: {
    fontSize: 12,
    fontWeight: "700",
  },
  modeHint: {
    position: "absolute",
    right: 56,
    bottom: 12,
    fontSize: 11,
    fontWeight: "700",
    width: 160,
    textAlign: "right",
  },
  button: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
