import { useCallback, useEffect, useRef, useState } from "react";

const HOLD_MS = 220;
const CANCEL_DX = 72;

export type RecordMode = "voice" | "video";

export type RecordFinishInfo = {
  wasVideo: boolean;
  didStart: boolean;
  durationMs: number;
};

type HoldToRecordOptions = {
  disabled?: boolean;
  /** Called once the press has been held long enough to start recording. */
  onHoldStart: (mode: RecordMode) => void;
  /** Called on release after a hold; `cancel` is true when the finger slid left. */
  onFinish: (cancel: boolean, info: RecordFinishInfo) => void;
};

/**
 * Gesture + timer state shared by the native and web record buttons:
 * tap toggles voice/video, hold records, slide left cancels.
 * Platform files only implement how recording starts and stops.
 */
export function useHoldToRecord({ disabled, onHoldStart, onFinish }: HoldToRecordOptions) {
  const [mode, setMode] = useState<RecordMode>("voice");
  const [recording, setRecording] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [recordMs, setRecordMs] = useState(0);

  const modeRef = useRef(mode);
  /** True while the user is holding (recording requested). */
  const holdingRef = useRef(false);
  /** True once the platform recorder actually started. */
  const startedRef = useRef(false);
  const cancellingRef = useRef(false);
  const downX = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const callbacks = useRef({ onHoldStart, onFinish });

  modeRef.current = mode;
  callbacks.current = { onHoldStart, onFinish };

  const clearHoldTimer = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const clearTick = useCallback(() => {
    if (tick.current) {
      clearInterval(tick.current);
      tick.current = null;
    }
  }, []);

  /** Platform code calls this once its recorder is really running. */
  const markStarted = useCallback(() => {
    startedAt.current = Date.now();
    startedRef.current = true;
    setRecordMs(0);
    clearTick();
    tick.current = setInterval(() => setRecordMs(Date.now() - startedAt.current), 200);
  }, [clearTick]);

  /** Ends the hold without a finish callback (e.g. the web camera picker closed). */
  const endHold = useCallback(() => {
    holdingRef.current = false;
    setRecording(false);
  }, []);

  useEffect(
    () => () => {
      clearHoldTimer();
      clearTick();
      holdingRef.current = false;
    },
    [clearHoldTimer, clearTick],
  );

  const onGrant = (pageX: number) => {
    if (disabled) return;
    downX.current = pageX;
    cancellingRef.current = false;
    setCancelling(false);
    holdingRef.current = false;
    startedRef.current = false;
    clearHoldTimer();
    holdTimer.current = setTimeout(() => {
      holdingRef.current = true;
      setRecording(true);
      callbacks.current.onHoldStart(modeRef.current);
    }, HOLD_MS);
  };

  const onMove = (pageX: number) => {
    if (!holdingRef.current && !holdTimer.current) return;
    const cancel = downX.current - pageX > CANCEL_DX;
    if (cancel !== cancellingRef.current) {
      cancellingRef.current = cancel;
      setCancelling(cancel);
    }
  };

  const onRelease = () => {
    const held = holdingRef.current || startedRef.current;
    clearHoldTimer();
    if (!held) {
      setMode((current) => (current === "voice" ? "video" : "voice"));
      return;
    }
    clearTick();
    holdingRef.current = false;
    setRecording(false);
    setCancelling(false);
    const info: RecordFinishInfo = {
      wasVideo: modeRef.current === "video",
      didStart: startedRef.current,
      durationMs: Date.now() - startedAt.current,
    };
    startedRef.current = false;
    callbacks.current.onFinish(cancellingRef.current, info);
  };

  return {
    mode,
    recording,
    cancelling,
    recordMs,
    holdingRef,
    startedRef,
    markStarted,
    endHold,
    gesture: { onGrant, onMove, onRelease },
  };
}

export type HoldToRecordState = ReturnType<typeof useHoldToRecord>;
