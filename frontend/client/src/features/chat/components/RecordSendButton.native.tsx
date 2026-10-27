import { Camera, CameraView } from "expo-camera";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { useColors } from "@/shared/theme";

import { VIDEO_NOTE_MARKER } from "../constants";
import { useHoldToRecord, type RecordFinishInfo } from "../hooks/useHoldToRecord";
import type { ChatMediaDraft } from "../types";
import { RecordButtonView } from "./RecordButtonView";

const MIN_RECORDING_MS = 600;
const MAX_VIDEO_SECONDS = 60;

type RecordSendButtonProps = {
  disabled?: boolean;
  onSendMedia: (draft: ChatMediaDraft) => void;
};

export function RecordSendButton({ disabled, onSendMedia }: RecordSendButtonProps) {
  const colors = useColors();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const cameraRef = useRef<CameraView>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const videoPromise = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const cameraReady = useRef(false);
  const pendingVideoStart = useRef(false);
  /** Stops the in-flight camera recording; set only while one is running. */
  const stopCamera = useRef<(() => void) | null>(null);

  const rec = useHoldToRecord({
    disabled,
    onHoldStart: (mode) => void (mode === "video" ? startVideo() : startVoice()),
    onFinish: (cancel, info) => void finish(cancel, info),
  });

  /** Starts the camera recording once the camera is ready and the user still holds. */
  const beginVideoIfReady = () => {
    const camera = cameraRef.current;
    if (!camera || !cameraReady.current || !rec.holdingRef.current || rec.startedRef.current) {
      return;
    }
    videoPromise.current = camera.recordAsync({ maxDuration: MAX_VIDEO_SECONDS });
    stopCamera.current = () => camera.stopRecording();
    pendingVideoStart.current = false;
    rec.markStarted();
  };

  const startVoice = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Microphone needed", "Allow microphone access to send voice messages.");
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    if (!rec.holdingRef.current) return;
    recorder.record();
    rec.markStarted();
  };

  const startVideo = async () => {
    const camera = await Camera.requestCameraPermissionsAsync();
    const mic = await Camera.requestMicrophonePermissionsAsync();
    if (!camera.granted || !mic.granted) {
      Alert.alert("Camera needed", "Allow camera and microphone to send a video message.");
      return;
    }
    setCameraOpen(true);
    pendingVideoStart.current = true;
    beginVideoIfReady();
  };

  const onCameraReady = () => {
    cameraReady.current = true;
    if (pendingVideoStart.current) beginVideoIfReady();
  };

  const finish = async (cancel: boolean, { wasVideo, didStart, durationMs }: RecordFinishInfo) => {
    pendingVideoStart.current = false;
    try {
      if (wasVideo) {
        stopCamera.current?.();
        stopCamera.current = null;
        const recorded = await (videoPromise.current ?? Promise.resolve(undefined)).catch(
          () => undefined,
        );
        videoPromise.current = null;
        setCameraOpen(false);
        cameraReady.current = false;
        if (cancel || !didStart || !recorded?.uri || durationMs < MIN_RECORDING_MS) {
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
        if (cancel || !uri || durationMs < MIN_RECORDING_MS) {
          return;
        }
        onSendMedia({
          type: "VOICE",
          uri,
          mimeType: "audio/mp4",
          fileName: "voice.m4a",
          durationMs,
        });
      }
    } catch {
      setCameraOpen(false);
      if (!cancel) {
        Alert.alert("Could not record", "Try again in a moment.");
      }
    }
  };

  useEffect(
    () => () => {
      pendingVideoStart.current = false;
      stopCamera.current?.();
      stopCamera.current = null;
    },
    [],
  );

  return (
    <RecordButtonView disabled={disabled} state={rec}>
      {cameraOpen ? (
        <View style={styles.cameraLayer} pointerEvents="none">
          <View
            style={[
              styles.circleMask,
              { borderColor: rec.cancelling ? colors.rose : colors.white },
            ]}
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
    </RecordButtonView>
  );
}

const styles = StyleSheet.create({
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
