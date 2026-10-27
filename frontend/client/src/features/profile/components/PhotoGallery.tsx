import { Ionicons } from "@expo/vector-icons";
import { memo, useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

import { uploadChatFile } from "@/features/chat/api/chatApi";
import { remoteImageSource, resolveMediaUrl } from "@/lib/mediaUrl";
import { ImageViewerModal } from "@/shared/components/ImageViewerModal";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";
import { MAX_PROFILE_PHOTOS } from "@sayly/shared";

import { GALLERY_MAX_EDGE } from "../model/avatar";
import { compressImage, pickImage } from "../model/imageCompression";

const COLUMNS = 3;

type TileStatus = "loading" | "loaded" | "error";

/** One square photo: neutral placeholder while loading, icon fallback if it cannot load. */
const GalleryImage = memo(function GalleryImage({ uri }: { uri: string | null }) {
  const colors = useColors();
  const [status, setStatus] = useState<TileStatus>(uri ? "loading" : "error");

  return (
    <>
      {uri && status !== "error" ? (
        <Image
          source={remoteImageSource(uri)}
          style={styles.image}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      ) : null}
      {status === "loading" ? (
        <View style={styles.overlayCenter}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : null}
      {status === "error" ? (
        <View style={styles.overlayCenter} accessibilityLabel="Photo unavailable">
          <Ionicons name="image-outline" size={26} color={colors.muted} />
        </View>
      ) : null}
    </>
  );
});

type PhotoGalleryProps = {
  photos: readonly string[];
  /** Edit mode: receives the full new list after an add/remove. */
  onChange?: (photos: string[]) => void;
};

/**
 * Profile photo grid: tap to view full-screen. In edit mode it shows all slots
 * (photos, one "add" tile, then empty slots); each photo has a delete button that removes
 * it from the form at once and frees its slot — the server applies it on Save.
 */
export const PhotoGallery = memo(function PhotoGallery({ photos, onChange }: PhotoGalleryProps) {
  const colors = useColors();
  const [viewing, setViewing] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const closeViewer = useCallback(() => setViewing(null), []);

  const addPhoto = useCallback(async () => {
    if (!onChange) return;
    const picked = await pickImage({ square: false });
    if (picked.denied) {
      Alert.alert("Permission needed", "Allow photo library access to add photos to your profile.");
      return;
    }
    if (!picked.asset) return;

    setUploading(true);
    try {
      const file = await compressImage(picked.asset, { maxEdge: GALLERY_MAX_EDGE, output: "file" });
      const uploaded = await uploadChatFile(file, "image/jpeg", "gallery.jpg");
      // Keep the signed URL so the new tile renders right away; the API stores the stable path.
      onChange([...photos, uploaded.signedUrl ?? uploaded.url]);
    } catch {
      Alert.alert("Could not add this photo", "Check your connection or choose a different image.");
    } finally {
      setUploading(false);
    }
  }, [onChange, photos]);

  const removePhoto = useCallback(
    (photo: string) => onChange?.(photos.filter((item) => item !== photo)),
    [onChange, photos],
  );

  const editing = Boolean(onChange);
  const canAdd = editing && photos.length < MAX_PROFILE_PHOTOS;
  // Edit mode keeps the grid at its full size so free slots are visible.
  const emptySlots = editing ? Math.max(0, MAX_PROFILE_PHOTOS - photos.length - 1) : 0;
  if (photos.length === 0 && !canAdd) {
    return null;
  }

  return (
    <View style={styles.grid}>
      {photos.map((photo, index) => {
        const uri = resolveMediaUrl(photo) ?? null;
        return (
          <View key={photo} style={styles.cell}>
            <Pressable
              onPress={() => setViewing(uri)}
              style={[styles.tile, { backgroundColor: colors.inputBg }]}
              accessibilityRole="imagebutton"
              accessibilityLabel="View photo"
            >
              <GalleryImage uri={uri} />
            </Pressable>
            {onChange ? (
              <Pressable
                onPress={() => removePhoto(photo)}
                style={({ pressed }) => [
                  styles.remove,
                  { backgroundColor: colors.rose, borderColor: colors.white },
                  pressed && styles.removePressed,
                ]}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Delete photo ${index + 1}`}
              >
                <Ionicons name="trash-outline" size={15} color={colors.white} />
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {canAdd ? (
        <View style={styles.cell}>
          <Pressable
            onPress={() => void addPhoto()}
            disabled={uploading}
            style={[
              styles.tile,
              styles.add,
              { borderColor: colors.cardBorder, backgroundColor: colors.card },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add photo"
          >
            {uploading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <Ionicons name="add" size={26} color={colors.accent} />
                <Text style={[styles.addLabel, { color: colors.muted }]}>
                  {photos.length}/{MAX_PROFILE_PHOTOS}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}

      {Array.from({ length: emptySlots }, (_, index) => (
        <View key={`empty-${index}`} style={styles.cell}>
          <View
            style={[styles.tile, styles.empty, { borderColor: colors.cardBorder }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </View>
      ))}

      <ImageViewerModal uri={viewing} onClose={closeViewer} />
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs / 2,
  },
  cell: {
    width: `${100 / COLUMNS}%`,
    padding: spacing.xs / 2,
  },
  tile: {
    aspectRatio: 1,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  overlayCenter: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  add: {
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  addLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    opacity: 0.5,
  },
  remove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  removePressed: {
    opacity: 0.7,
  },
});
