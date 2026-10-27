import * as ImagePicker from "expo-image-picker";
import { useRef } from "react";
import { Alert } from "react-native";

import { VIDEO_NOTE_MARKER } from "../constants";
import { useHoldToRecord, type RecordFinishInfo } from "../hooks/useHoldToRecord";
import type { ChatMediaDraft } from "../types";
import { blobToPlayableAudio, pickRecorderMime } from "../utils/webAudioWav";
import { RecordButtonView } from "./RecordButtonView";

const MIN_RECORDING_MS = 600;

type RecordSendButtonProps = {
  disabled?: boolean;
  onSendMedia: (draft: ChatMediaDraft) => void;
};

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function RecordSendButton({ disabled, onSendMedia }: RecordSendButtonProps) {
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const rec = useHoldToRecord({
    disabled,
    onHoldStart: (mode) => void (mode === "video" ? startVideo() : startVoice()),
    onFinish: (cancel, info) => void finish(cancel, info),
  });

  const startVoice = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      Alert.alert("Microphone needed", "Voice recording is not available in this browser.");
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!rec.holdingRef.current) {
      stopTracks(stream);
      return;
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
    rec.markStarted();
  };

  // On web the browser camera UI records the clip; the hold just opens it.
  const startVideo = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera needed", "Allow camera access to send a video message.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
      videoMaxDuration: 60,
      quality: 0.8,
    });
    rec.endHold();
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
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
  };

  const finish = async (cancel: boolean, { wasVideo, didStart, durationMs }: RecordFinishInfo) => {
    if (wasVideo) return;

    const recorder = mediaRecorder.current;
    mediaRecorder.current = null;
    const stream = streamRef.current;
    streamRef.current = null;

    if (!recorder || !didStart) {
      stopTracks(stream);
      return;
    }

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        const collect = () => new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" });
        recorder.onstop = () => resolve(collect());
        recorder.onerror = () => reject(new Error("record-failed"));
        if (recorder.state !== "inactive") recorder.stop();
        else resolve(collect());
      });
      stopTracks(stream);
      if (cancel || blob.size < 1 || durationMs < MIN_RECORDING_MS) {
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
      stopTracks(stream);
      if (!cancel) {
        Alert.alert("Could not record", "Try again in a moment.");
      }
    }
  };

  return <RecordButtonView disabled={disabled} state={rec} />;
}
