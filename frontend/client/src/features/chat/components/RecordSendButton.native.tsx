import { Ionicons } from "@expo/vector-icons";
import { Camera, CameraView } from "expo-camera";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/shared/theme";

import { VIDEO_NOTE_MARKER } from "../constants";
import type { ChatMediaDraft } from "../types";
import { formatDuration } from "../utils/messagePreview";

const HOLD_MS = 220;
const CANCEL_DX = 72;

type RecordSendButtonProps = {
  disabled?: boolean;
  onSendMedia: (draft: ChatMediaDraft) => void;
};

export function RecordSendButton({ disabled, onSendMedia }: RecordSendButtonProps) {
  const colors = useColors();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const cameraRef = useRef<CameraView>(null);
  const [mode, setMode] = useState<"voice" | "video">("voice");
  const [recording, setRecording] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const [cameraOpen, setCameraOpen] = useState(false);

  const modeRef = useRef(mode);
  const recordingRef = useRef(false);
  const cancellingRef = useRef(false);
  const startedRef = useRef(false);
  const downX = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const videoPromise = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const cameraReady = useRef(false);
  const pendingVideoStart = useRef(false);

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
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Microphone needed", "Allow microphone access to send voice messages.");
      return false;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    if (!recordingRef.current) return false;
    recorder.record();
    startClock();
    startedRef.current = true;
    return true;
  }, [recorder]);

  const startVideo = useCallback(async () => {
    const camera = await Camera.requestCameraPermissionsAsync();
    const mic = await Camera.requestMicrophonePermissionsAsync();
    if (!camera.granted || !mic.granted) {
      Alert.alert("Camera needed", "Allow camera and microphone to send a video message.");
      return false;
    }
    setCameraOpen(true);
    pendingVideoStart.current = true;
    if (cameraReady.current && cameraRef.current && recordingRef.current) {
      videoPromise.current = cameraRef.current.recordAsync({ maxDuration: 60 });
      startClock();
      startedRef.current = true;
      pendingVideoStart.current = false;
    }
    return true;
  }, []);

  const onCameraReady = () => {
    cameraReady.current = true;
    if (
      pendingVideoStart.current &&
      recordingRef.current &&
      cameraRef.current &&
      !startedRef.current
    ) {
      videoPromise.current = cameraRef.current.recordAsync({ maxDuration: 60 });
      startClock();
      startedRef.current = true;
      pendingVideoStart.current = false;
    }
  };

  const finish = useCallback(
    async (cancel: boolean) => {
      clearTick();
      recordingRef.current = false;
      setRecording(false);
      setCancelling(false);
      const wasVideo = modeRef.current === "video";
      const didStart = startedRef.current;
      startedRef.current = false;
      pendingVideoStart.current = false;
      const durationMs = Date.now() - startedAt.current;

      try {
        if (wasVideo) {
          cameraRef.current?.stopRecording();
          const recorded = await (videoPromise.current ?? Promise.resolve(undefined)).catch(
            () => undefined,
          );
          videoPromise.current = null;
          setCameraOpen(false);
          cameraReady.current = false;
          if (cancel || !didStart || !recorded?.uri || durationMs < 600) {
            return;
          }
          onSendMedia({
            type: "VIDEO",
            uri: recorded.uri,
            mimeType: "video/mp4",
            fileName: "video-note.mp4",
            durationMs,
            thumbnailUrl: VIDEO_NOTE_MARKER,
          });
          return;
        }

        if (didStart) {
          await recorder.stop();
          await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
          const uri = recorder.uri;
          if (cancel || !uri || durationMs < 600) {
            return;
          }
          onSendMedia({
            type: "VOICE",
            uri,
            mimeType: Platform.OS === "web" ? "audio/webm" : "audio/mp4",
            fileName: Platform.OS === "web" ? "voice.webm" : "voice.m4a",
            durationMs,
          });
        }
      } catch {
        setCameraOpen(false);
        if (!cancel) {
          Alert.alert("Could not record", "Try again in a moment.");
        }
      }
    },
    [onSendMedia, recorder],
  );

  useEffect(() => {
    return () => {
      clearHoldTimer();
      clearTick();
      recordingRef.current = false;
      pendingVideoStart.current = false;
      if (cameraRef.current && startedRef.current) {
        cameraRef.current.stopRecording();
      }
      setCameraOpen(false);
    };
  }, []);

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
            borderRadius: videoMode || recording ? 20 : 20,
          },
        ]}
      >
        <Ionicons name={videoMode ? "videocam" : "mic"} size={20} color={colors.white} />
      </View>

      {cameraOpen ? (
        <View style={styles.cameraLayer} pointerEvents="none">
          <View
            style={[styles.circleMask, { borderColor: cancelling ? colors.rose : colors.white }]}
          >
            <CameraView
              ref={cameraRef}
              mode="video"
              facing="front"
              style={StyleSheet.absoluteFill}
              onCameraReady={onCameraReady}
            />
          </View>
        </View>
      ) : null}
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
  cameraLayer: {
    position: "absolute",
    right: -4,
    bottom: 52,
    width: 148,
    height: 148,
    alignItems: "center",
    justifyContent: "center",
  },
  circleMask: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: "hidden",
    borderWidth: 3,
    backgroundColor: "#111",
  },
});
