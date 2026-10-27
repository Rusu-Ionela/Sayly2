export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];

/** Parsed avatar from the edit-profile payload; `null` (in the input) clears it. */
export type AvatarInput =
  | { kind: "url"; url: string }
  | { kind: "inline"; mimeType: AvatarMimeType; data: Buffer };
