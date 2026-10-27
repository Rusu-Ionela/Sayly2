import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/shared/theme";

import type { HoldToRecordState } from "../hooks/useHoldToRecord";
import { formatDuration } from "../utils/messagePreview";

type RecordButtonViewProps = {
  disabled?: boolean;
  state: HoldToRecordState;
  /** Extra layer rendered above the button (the native camera bubble). */
  children?: ReactNode;
};

/** Hold-to-record button UI shared by the native and web implementations. */
export function RecordButtonView({ disabled, state, children }: RecordButtonViewProps) {
  const colors = useColors();
  const { mode, recording, cancelling, recordMs, gesture } = state;
  const videoMode = mode === "video";

  return (
    <View>
      {recording ? (
        <View pointerEvents="none" style={styles.hintWrap}>
          <Text style={[styles.hint, { color: cancelling ? colors.rose : colors.muted }]}>
            {cancelling
              ? "Release to delete"
              : `Slide left to cancel · ${formatDuration(recordMs)}`}
          </Text>
        </View>
      ) : videoMode ? (
        <Text pointerEvents="none" style={[styles.modeHint, { color: colors.muted }]}>
          Video message — hold to record
        </Text>
      ) : null}

      <View
        onStartShouldSetResponder={() => !disabled}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => gesture.onGrant(event.nativeEvent.pageX)}
        onResponderMove={(event) => gesture.onMove(event.nativeEvent.pageX)}
        onResponderRelease={gesture.onRelease}
        onResponderTerminate={gesture.onRelease}
        accessibilityRole="button"
        accessibilityLabel={
          videoMode
            ? "Tap for voice, hold to record a video message"
            : "Tap for video message, hold to record voice"
        }
        style={[
          styles.button,
          { backgroundColor: recording && cancelling ? colors.rose : colors.accent },
        ]}
      >
        <Ionicons name={videoMode ? "videocam" : "mic"} size={20} color={colors.white} />
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hintWrap: {
    position: "absolute",
    right: 56,
    bottom: 10,
    width: 220,
    alignItems: "flex-end",
  },
  hint: {
    fontSize: 12,
    fontWeight: "700",
  },
  modeHint: {
    position: "absolute",
    right: 56,
    bottom: 12,
    fontSize: 11,
    fontWeight: "700",
    width: 160,
    textAlign: "right",
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
