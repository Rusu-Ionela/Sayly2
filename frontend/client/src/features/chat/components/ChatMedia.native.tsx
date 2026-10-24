import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useId } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { resolveMediaUrl } from "@/lib/mediaUrl";

import { claimMediaPlayback, releaseMediaPlayback } from "../mediaPlayback";
import { formatDuration } from "../utils/messagePreview";

type ChatVoiceProps = {
  uri: string;
  durationMs?: number | null;
  light?: boolean;
};

export function ChatVoice({ uri, durationMs, light }: ChatVoiceProps) {
  const playbackId = useId();
  const resolved = resolveMediaUrl(uri) ?? uri;
  const player = useAudioPlayer(resolved);
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;
  const label = formatDuration(
    playing
      ? Math.round(status.currentTime * 1000)
      : (durationMs ?? Math.round((status.duration || 0) * 1000)),
  );

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // ignore
      }
      releaseMediaPlayback(playbackId);
    };
  }, [playbackId, player]);

  return (
    <Pressable
      onPress={() => {
        if (playing) {
          player.pause();
          releaseMediaPlayback(playbackId);
          return;
        }
        claimMediaPlayback(playbackId, () => {
          try {
            player.pause();
          } catch {
            // ignore
          }
        });
        if (status.currentTime >= status.duration && status.duration > 0) {
          void player.seekTo(0).then(() => player.play());
          return;
        }
        player.play();
      }}
      style={styles.voiceRow}
      accessibilityRole="button"
      accessibilityLabel={playing ? "Pause voice message" : "Play voice message"}
    >
      <View
        style={[
          styles.playDisc,
          { backgroundColor: light ? "rgba(76,53,245,0.16)" : "rgba(15,23,42,0.08)" },
        ]}
      >
        <Ionicons
          name={playing ? "pause" : "play"}
          size={16}
          color={light ? "#4C35F5" : "#1E1B4B"}
        />
      </View>
      <Text style={[styles.voiceLabel, { color: light ? "#1E1B4B" : "#334155" }]}>{label}</Text>
    </Pressable>
  );
}

type ChatVideoProps = {
  uri: string;
  round?: boolean;
  fill?: boolean;
};

export function ChatVideo({ uri, round, fill }: ChatVideoProps) {
  const playbackId = useId();
  const resolved = resolveMediaUrl(uri) ?? uri;
  const player = useVideoPlayer(resolved, (instance) => {
    instance.loop = Boolean(fill);
  });

  useEffect(() => {
    const sub = player.addListener("playingChange", ({ isPlaying }) => {
      if (isPlaying) {
        claimMediaPlayback(playbackId, () => {
          try {
            player.pause();
          } catch {
            // ignore
          }
        });
      } else {
        releaseMediaPlayback(playbackId);
      }
    });
    return () => {
      sub.remove();
      try {
        player.pause();
      } catch {
        // ignore
      }
      releaseMediaPlayback(playbackId);
    };
  }, [playbackId, player]);

  return (
    <VideoView
      player={player}
      style={fill ? styles.fill : round ? styles.videoNote : styles.video}
      nativeControls
      contentFit={fill ? "contain" : "cover"}
    />
  );
}

const styles = StyleSheet.create({
  voiceRow: {
    minWidth: 148,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
    paddingRight: 8,
  },
  playDisc: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceLabel: {
    fontWeight: "700",
    fontSize: 15,
  },
  video: {
    width: 236,
    height: 168,
    borderRadius: 14,
    backgroundColor: "#111",
  },
  videoNote: {
    width: 168,
    height: 168,
    borderRadius: 84,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  fill: {
    width: "100%",
    height: "100%",
  },
});
