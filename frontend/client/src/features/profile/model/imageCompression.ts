import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { MAX_AVATAR_BYTES } from "@sayly/shared";

import { base64ByteLength } from "./avatar";

/** Tried in order until the encoded image fits under MAX_AVATAR_BYTES. */
const JPEG_QUALITIES = [0.8, 0.6, 0.4];

export type CompressedOutput = "file" | "dataUri";

/**
 * Downscales to `maxEdge` and re-encodes as JPEG (which also strips EXIF/GPS).
 * `file` → local URI for a multipart upload; `dataUri` → inline base64 for the profile API.
 */
export async function compressImage(
  asset: ImagePicker.ImagePickerAsset,
  { maxEdge, output }: { maxEdge: number; output: CompressedOutput },
): Promise<string> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > maxEdge) {
    context.resize(asset.width >= asset.height ? { width: maxEdge } : { height: maxEdge });
  }
  const image = await context.renderAsync();

  try {
    for (const compress of JPEG_QUALITIES) {
      const result = await image.saveAsync({
        compress,
        format: SaveFormat.JPEG,
        base64: output === "dataUri",
      });
      if (output === "file") {
        return result.uri;
      }
      if (result.base64 && base64ByteLength(result.base64) <= MAX_AVATAR_BYTES) {
        return `data:image/jpeg;base64,${result.base64}`;
      }
    }
    throw new Error("Image is too large");
  } finally {
    image.release();
    context.release();
  }
}

/** Asks for library access, then lets the user pick one image (asset is undefined if cancelled). */
export async function pickImage(options: { square: boolean }) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { denied: true as const };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: options.square,
    aspect: options.square ? [1, 1] : undefined,
    quality: 1,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  return { denied: false as const, asset: asset?.uri ? asset : undefined };
}
