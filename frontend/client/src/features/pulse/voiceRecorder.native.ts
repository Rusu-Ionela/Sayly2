import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import type { RecordedNote } from "./api";
import { MIN_NOTE_MS, type VoiceNoteRecorder } from "./recorderTypes";

/** Records one short voice note; stops by itself at `maxMs` and hands the note to `onAutoStop`. */
export function useVoiceNoteRecorder(
  maxMs: number,
  onAutoStop: (note: RecordedNote | null) => void,
): VoiceNoteRecorder {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef(0);
  const active = useRef(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStop = useRef(onAutoStop);
  autoStop.current = onAutoStop;

  const clearTick = () => {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
  };

  const finish = useCallback(
    async (keep: boolean): Promise<RecordedNote | null> => {
      if (!active.current) return null;
      active.current = false;
      clearTick();
      setRecording(false);
      const durationMs = Math.min(Date.now() - startedAt.current, maxMs);
      try {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      } catch {
        return null;
      }
      const uri = recorder.uri;
      if (!keep || !uri || durationMs < MIN_NOTE_MS) return null;
      return { uri, mimeType: "audio/mp4", fileName: "spark.m4a", durationMs };
    },
    [maxMs, recorder],
  );

  const start = useCallback(async () => {
    if (active.current) return true;
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Microphone needed", "Allow microphone access to record a Voice Spark.");
      return false;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      Alert.alert("Could not record", "Try again in a moment.");
      return false;
    }
    active.current = true;
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
  }, [finish, maxMs, recorder]);

  const stop = useCallback(() => finish(true), [finish]);
  const cancel = useCallback(async () => {
    await finish(false);
  }, [finish]);

  useEffect(
    () => () => {
      clearTick();
      if (active.current) {
        active.current = false;
        void recorder.stop().catch(() => undefined);
      }
    },
    [recorder],
  );

  return { recording, elapsedMs, start, stop, cancel };
}
