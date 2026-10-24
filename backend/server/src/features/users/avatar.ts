/** PRO-002 avatar limits — shared by validation (inline base64) and the stored-media check. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];

/** Parsed avatar from the edit-profile payload; `null` (in the input) clears it. */
export type AvatarInput =
  | { kind: "url"; url: string }
  | { kind: "inline"; mimeType: AvatarMimeType; data: Buffer };
