import * as Speech from "expo-speech";
import { useCallback, useEffect, useState } from "react";

/**
 * Text-to-speech for the Collection's play buttons. One utterance at a time; `speakingId`
 * tells which card shows the "playing" state.
 */
export function useSpeech() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  useEffect(() => () => void Speech.stop(), []);

  const toggle = useCallback(
    (id: string, text: string, languageCode: string | null) => {
      void Speech.stop();
      if (speakingId === id) {
        setSpeakingId(null);
        return;
      }
      setSpeakingId(id);
      const done = () => setSpeakingId((current) => (current === id ? null : current));
      Speech.speak(text, {
        language: languageCode ?? undefined,
        rate: 0.9,
        onDone: done,
        onStopped: done,
        onError: done,
      });
    },
    [speakingId],
  );

  return { speakingId, toggle };
}
