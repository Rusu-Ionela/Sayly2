import { useStreakCelebration, useStreakSync } from "./hooks";
import { StreakCelebrationModal } from "./StreakCelebrationModal";

/** Mounted once inside the signed-in app: keeps the streak live and celebrates a new day. */
export function StreakBridge() {
  useStreakSync();
  const { celebration, dismiss } = useStreakCelebration();
  return <StreakCelebrationModal celebration={celebration} onClose={dismiss} />;
}
