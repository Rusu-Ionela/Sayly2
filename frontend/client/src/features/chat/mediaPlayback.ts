/**
 * Ensures only one voice/video clip plays at a time across chat bubbles.
 * Each player registers a stop callback when it starts; claiming playback
 * pauses any previous owner.
 */
type StopFn = () => void;

let activeStop: StopFn | null = null;
let activeId: string | null = null;

export function claimMediaPlayback(id: string, stop: StopFn) {
  if (activeId === id) {
    activeStop = stop;
    return;
  }
  if (activeStop) {
    try {
      activeStop();
    } catch {
      // ignore pause failures from unmounted players
    }
  }
  activeId = id;
  activeStop = stop;
}

export function releaseMediaPlayback(id: string) {
  if (activeId === id) {
    activeId = null;
    activeStop = null;
  }
}
