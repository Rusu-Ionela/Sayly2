import { setAudioModeAsync } from "expo-audio";
import { Platform } from "react-native";

/**
 * Switches call audio between the earpiece and the loudspeaker.
 * WebRTC owns the microphone; we only change where the other person's voice comes out.
 */
export async function setCallSpeaker(speakerOn: boolean) {
  if (Platform.OS === "web") return;
  try {
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: !speakerOn,
    });
  } catch {
    // Routing is a convenience; a failure must never drop the call.
  }
}

/** Puts audio back to normal playback (voice messages, videos) once a call is over. */
export async function resetCallAudio() {
  if (Platform.OS === "web") return;
  try {
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
    });
  } catch {
    // ignore
  }
}
