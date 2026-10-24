import { memo, useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/shared/components/Avatar";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { AVATAR_MAX_EDGE } from "../model/avatar";
import { compressImage, pickImage, type CompressedOutput } from "../model/imageCompression";

type ImagePickerAvatarProps = {
  /** Current avatar (remote URL, media path, local file or data URI). */
  uri?: string;
  /** Initials fallback. */
  name?: string;
  size?: number;
  output?: CompressedOutput;
  disabled?: boolean;
  /** Receives the compressed image, or "" when the user removes the photo. */
  onChange: (value: string) => void;
};

/** PRO-002 — pick, square-crop and compress a profile photo before it is uploaded. */
export const ImagePickerAvatar = memo(function ImagePickerAvatar({
  uri,
  name,
  size = 96,
  output = "file",
  disabled = false,
  onChange,
}: ImagePickerAvatarProps) {
  const colors = useColors();
  const [processing, setProcessing] = useState(false);

  const pickPhoto = useCallback(async () => {
    const picked = await pickImage({ square: true });
    if (picked.denied) {
      Alert.alert("Permission needed", "Allow photo library access to set your profile picture.");
      return;
    }
    const asset = picked.asset;
    if (!asset) {
      return;
    }

    setProcessing(true);
    try {
      onChange(await compressImage(asset, { maxEdge: AVATAR_MAX_EDGE, output }));
    } catch {
      Alert.alert("Could not use this photo", "Please choose a different image.");
    } finally {
      setProcessing(false);
    }
  }, [onChange, output]);

  const removePhoto = useCallback(() => onChange(""), [onChange]);
  const busy = disabled || processing;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => void pickPhoto()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={uri ? "Change profile photo" : "Add profile photo"}
        style={styles.avatarHit}
      >
        <Avatar uri={uri} name={name} size={size} />
        <View style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.card }]}>
          {processing ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{uri ? "✎" : "+"}</Text>
          )}
        </View>
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          onPress={() => void pickPhoto()}
          disabled={busy}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={[styles.action, { color: colors.accent }]}>
            {uri ? "Change photo" : "Add profile photo"}
          </Text>
        </Pressable>
        {uri ? (
          <Pressable onPress={removePhoto} disabled={busy} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.action, { color: colors.muted }]}>Remove</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: spacing.sm,
  },
  avatarHit: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontWeight: "800",
    fontSize: 15,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  action: {
    fontWeight: "700",
    fontSize: 14,
  },
});
