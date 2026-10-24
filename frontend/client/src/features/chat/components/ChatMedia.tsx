import { Ionicons } from "@expo/vector-icons";
import { createElement, useEffect, useId, useRef, useState } from "react";
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
  const src = resolveMediaUrl(uri) ?? uri;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listenersRef = useRef<{ ended: () => void; error: () => void } | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPlaying(false);
    return () => {
      const audio = audioRef.current;
      const listeners = listenersRef.current;
      if (audio && listeners) {
        audio.removeEventListener("ended", listeners.ended);
        audio.removeEventListener("error", listeners.error);
      }
      listenersRef.current = null;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        audioRef.current = null;
      }
      releaseMediaPlayback(playbackId);
    };
  }, [src, playbackId]);

  const toggle = () => {
    if (!audioRef.current) {
      const audio = new Audio(src);
      audio.crossOrigin = "anonymous";
      const ended = () => {
        setPlaying(false);
        releaseMediaPlayback(playbackId);
      };
      const error = () => {
        setPlaying(false);
        releaseMediaPlayback(playbackId);
      };
      audio.addEventListener("ended", ended);
      audio.addEventListener("error", error);
      listenersRef.current = { ended, error };
      audioRef.current = audio;
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      releaseMediaPlayback(playbackId);
      return;
    }
    claimMediaPlayback(playbackId, () => {
      audioRef.current?.pause();
      setPlaying(false);
    });
    void audioRef.current
      .play()
      .then(() => setPlaying(true))
      .catch(() => {
        setPlaying(false);
        releaseMediaPlayback(playbackId);
      });
  };

  return (
    <Pressable
      onPress={toggle}
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
      <Text style={[styles.voiceLabel, { color: light ? "#1E1B4B" : "#334155" }]}>
        {formatDuration(durationMs)}
      </Text>
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
  const src = resolveMediaUrl(uri) ?? uri;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) {
        video.pause();
      }
      releaseMediaPlayback(playbackId);
    };
  }, [playbackId, src]);

  return (
    <View
      style={[
        fill ? styles.fill : round ? styles.videoNote : styles.video,
        round && styles.roundClip,
      ]}
    >
      {createElement("video", {
        src,
        controls: true,
        ref: (node: HTMLVideoElement | null) => {
          videoRef.current = node;
        },
        onPlay: () => {
          claimMediaPlayback(playbackId, () => {
            videoRef.current?.pause();
          });
        },
        onPause: () => {
          releaseMediaPlayback(playbackId);
        },
        onEnded: () => {
          releaseMediaPlayback(playbackId);
        },
        style: {
          width: "100%",
          height: "100%",
          objectFit: fill ? "contain" : "cover",
          borderRadius: round ? 84 : 14,
          backgroundColor: "#111",
        },
      })}
    </View>
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
    overflow: "hidden",
    backgroundColor: "#111",
  },
  videoNote: {
    width: 168,
    height: 168,
    borderRadius: 84,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  roundClip: {
    overflow: "hidden",
  },
  fill: {
    width: "100%",
    height: "100%",
  },
});
