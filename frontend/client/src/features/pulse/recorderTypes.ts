import type { RecordedNote } from "./api";

/** Shorter than this is a mis-tap, not a note. */
export const MIN_NOTE_MS = 1_000;

export type VoiceNoteRecorder = {
  recording: boolean;
  /** Time recorded so far, capped at the limit. */
  elapsedMs: number;
  /** Asks for the microphone and starts; false when it could not. */
  start: () => Promise<boolean>;
  /** Stops and returns the note, or null when it was too short or failed. */
  stop: () => Promise<RecordedNote | null>;
  cancel: () => Promise<void>;
};
