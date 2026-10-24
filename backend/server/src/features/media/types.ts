export type MediaKind = "image" | "audio" | "video";

export type UploadResult = {
  /** Stable path to persist in messages / profiles (no exp/sig). */
  url: string;
  /** Optional short-lived URL for immediate preview. */
  signedUrl?: string;
  mimeType: string;
  kind: MediaKind;
  size: number;
  assetId?: string;
};
