/** Mirrors the backend PRO-002 limit for inline (base64) avatars. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** Longest edge of the stored avatar — plenty for a 96pt circle on 3x screens. */
export const AVATAR_MAX_EDGE = 512;

/** Gallery photos are shown full-screen; 1080px JPEG stays well under MAX_AVATAR_BYTES. */
export const GALLERY_MAX_EDGE = 1080;

/** Decoded size of a base64 payload without allocating the bytes. */
export function base64ByteLength(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** The API still exposes legacy aliases; this is the one place that picks between them. */
export function profileAvatarUrl(profile: {
  avatarUrl?: string | null;
  profileImageUrl?: string | null;
  photoUrl?: string | null;
}): string | undefined {
  return profile.avatarUrl ?? profile.profileImageUrl ?? profile.photoUrl ?? undefined;
}
