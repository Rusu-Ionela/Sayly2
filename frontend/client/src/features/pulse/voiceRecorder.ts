import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import { blobToPlayableAudio, pickRecorderMime } from "@/features/chat/utils/webAudioWav";

import type { RecordedNote } from "./api";
import { MIN_NOTE_MS, type VoiceNoteRecorder } from "./recorderTypes";

/** Web twin of voiceRecorder.native.ts, built on MediaRecorder like the chat recorder. */
export function useVoiceNoteRecorder(
  maxMs: number,
  onAutoStop: (note: RecordedNote | null) => void,
): VoiceNoteRecorder {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStop = useRef(onAutoStop);
  autoStop.current = onAutoStop;

  const clearTick = () => {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const finish = useCallback(
    async (keep: boolean): Promise<RecordedNote | null> => {
      const recorder = recorderRef.current;
      if (!recorder) return null;
      recorderRef.current = null;
      clearTick();
      setRecording(false);
      const durationMs = Math.min(Date.now() - startedAt.current, maxMs);
      try {
        const blob = await new Promise<Blob>((resolve, reject) => {
          const done = () =>
            resolve(new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" }));
          recorder.onstop = done;
          recorder.onerror = () => reject(new Error("record-failed"));
          if (recorder.state !== "inactive") recorder.stop();
          else done();
        });
        releaseStream();
        if (!keep || blob.size < 1 || durationMs < MIN_NOTE_MS) return null;
        const playable = await blobToPlayableAudio(blob);
        return {
          uri: URL.createObjectURL(playable.blob),
          mimeType: playable.mimeType,
          fileName: playable.fileName,
          durationMs,
        };
      } catch {
        releaseStream();
        return null;
      }
    },
    [maxMs],
  );

  const start = useCallback(async () => {
    if (recorderRef.current) return true;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      Alert.alert("Microphone needed", "Voice recording is not available in this browser.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunks.current = [];
      const mime = pickRecorderMime();
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      recorderRef.current = recorder;
      recorder.start();
    } catch {
      releaseStream();
      Alert.alert("Microphone needed", "Allow microphone access to record a Voice Spark.");
      return false;
    }
    startedAt.current = Date.now();
    setElapsedMs(0);
    setRecording(true);
    clearTick();
    tick.current = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      setElapsedMs(Math.min(elapsed, maxMs));
      if (elapsed >= maxMs) {
        void finish(true).then((note) => autoStop.current(note));
      }
    }, 100);
    return true;
  }, [finish, maxMs]);

  const stop = useCallback(() => finish(true), [finish]);
  const cancel = useCallback(async () => {
    await finish(false);
  }, [finish]);

  useEffect(
    () => () => {
      clearTick();
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      releaseStream();
    },
    [],
  );

  return { recording, elapsedMs, start, stop, cancel };
}
