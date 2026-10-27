import { memo } from "react";
import { Modal, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";

import { remoteImageSource } from "@/lib/mediaUrl";

type ImageViewerModalProps = {
  /** Resolved image URL; the modal stays closed while null. */
  uri: string | null;
  onClose: () => void;
};

/** Full-screen, tap-to-dismiss photo viewer (avatars and gallery photos). */
export const ImageViewerModal = memo(function ImageViewerModal({
  uri,
  onClose,
}: ImageViewerModalProps) {
  return (
    <Modal visible={Boolean(uri)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close photo"
      >
        {uri ? (
          <Image
            source={remoteImageSource(uri)}
            style={styles.image}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        ) : null}
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  // Gallery photos are not square — fill the screen and letterbox with `contain`.
  image: {
    width: "100%",
    height: "100%",
  },
});
