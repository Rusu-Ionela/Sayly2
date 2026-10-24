import { cefrLevelEnum } from "../../db/schema";

/** Gallery photos besides the avatar; each is the user's own image ≤ MAX_AVATAR_BYTES. */
export const MAX_PROFILE_PHOTOS = 6;
export const MAX_TOPICS = 8;
export const MAX_CERTIFICATES = 10;
export const MIN_CERTIFICATE_YEAR = 1950;

export const CEFR_LEVELS = cefrLevelEnum.enumValues;
