import { createHmac, timingSafeEqual } from "crypto";
import { mkdirSync } from "fs";
import { open } from "fs/promises";

import { createId } from "@paralleldrive/cuid2";
import multer from "multer";

import { env } from "../../config/env";
import { AppError } from "../../shared/errors/AppError";

export const UPLOADS_DIR = env.uploadsDir;

/** Short-lived delivery signatures for Image/Audio clients that cannot send Authorization. */
export const MEDIA_DELIVERY_TTL_SECONDS = 60 * 60;

mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["image/heic", ".heic"],
  ["image/heif", ".heif"],
  ["audio/mp4", ".m4a"],
  ["audio/m4a", ".m4a"],
  ["audio/x-m4a", ".m4a"],
  ["audio/aac", ".aac"],
  ["audio/mpeg", ".mp3"],
  ["audio/wav", ".wav"],
  ["audio/x-wav", ".wav"],
  ["audio/webm", ".webm"],
  ["audio/3gpp", ".3gp"],
  ["video/mp4", ".mp4"],
  ["video/quicktime", ".mov"],
  ["video/webm", ".webm"],
  ["video/3gpp", ".3gp"],
]);

const BLOCKED_SNIFF = ["<html", "<svg", "<script", "<?xml"];

export function mediaKindFromMime(mime: string): "image" | "audio" | "video" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "audio";
}

export function extensionForMime(mime: string): string | null {
  return ALLOWED_MIME.get(mime.toLowerCase()) ?? null;
}

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime.toLowerCase());
}

const startsWith = (head: Buffer, bytes: number[], offset = 0) =>
  bytes.every((byte, index) => head[offset + index] === byte);

/** Magic bytes per declared type, so a client cannot label arbitrary bytes as an image. */
function matchesDeclaredType(mime: string, head: Buffer): boolean {
  const type = mime.toLowerCase();
  const isoBox = startsWith(head, [0x66, 0x74, 0x79, 0x70], 4); // "ftyp"
  if (type === "image/jpeg") return startsWith(head, [0xff, 0xd8, 0xff]);
  if (type === "image/png") return startsWith(head, [0x89, 0x50, 0x4e, 0x47]);
  if (type === "image/gif") return startsWith(head, [0x47, 0x49, 0x46, 0x38]);
  if (type === "image/webp") {
    return startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8);
  }
  if (type.includes("wav")) return startsWith(head, [0x52, 0x49, 0x46, 0x46]);
  if (type === "audio/webm" || type === "video/webm") return startsWith(head, [0x1a, 0x45, 0xdf, 0xa3]);
  if (type === "audio/mpeg") {
    return startsWith(head, [0x49, 0x44, 0x33]) || (head[0] === 0xff && ((head[1] ?? 0) & 0xe0) === 0xe0);
  }
  if (type === "audio/aac") return isoBox || (head[0] === 0xff && ((head[1] ?? 0) & 0xf0) === 0xf0);
  // heic/heif, mp4/m4a, mov and 3gp are all ISO base-media files.
  return isoBox;
}

export async function inspectUploadedFile(filePath: string, mimeType?: string): Promise<void> {
  const handle = await open(filePath, "r");
  const buffer = Buffer.alloc(512);
  let bytesRead = 0;
  try {
    ({ bytesRead } = await handle.read(buffer, 0, buffer.length, 0));
  } finally {
    await handle.close();
  }
  const head = buffer.toString("utf8").toLowerCase();
  if (
    BLOCKED_SNIFF.some((token) => head.includes(token)) ||
    (mimeType && !matchesDeclaredType(mimeType, buffer.subarray(0, bytesRead)))
  ) {
    throw new AppError("This file type is not allowed", 400, "VALIDATION_ERROR");
  }
}

function mediaSigningSecret(): string {
  return env.mediaSigningSecret;
}

function sign(storageKey: string, exp: number): string {
  return createHmac("sha256", mediaSigningSecret()).update(`${storageKey}.${exp}`).digest("hex");
}

/** Stable path stored in the database — never includes exp/sig query params. */
export function stableFilePath(storageKey: string): string {
  return `/media/files/${storageKey}`;
}

export function signedFileUrl(
  storageKey: string,
  ttlSeconds = MEDIA_DELIVERY_TTL_SECONDS,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = sign(storageKey, exp);
  return `/media/files/${storageKey}?exp=${exp}&sig=${sig}`;
}

export function extractStorageKey(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) {
    return null;
  }
  const marker = "/media/files/";
  const index = fileUrl.indexOf(marker);
  if (index === -1) {
    return null;
  }
  const raw = fileUrl.slice(index + marker.length).split("?")[0] ?? "";
  return safeStorageKey(raw);
}

/** Persist without query string so chat history does not die when a signature expires. */
export function toStoredMediaPath(fileUrl: string): string {
  const key = extractStorageKey(fileUrl);
  if (!key) {
    return fileUrl;
  }
  return stableFilePath(key);
}

/** Fresh short-lived URL for clients that load media by URI alone. */
export function resignMediaUrl(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) {
    return null;
  }
  const key = extractStorageKey(fileUrl);
  if (!key) {
    return fileUrl;
  }
  return signedFileUrl(key);
}

export function verifySignedFileUrl(
  storageKey: string,
  expRaw: string | undefined,
  sig: string | undefined,
): boolean {
  const exp = Number(expRaw);
  if (!sig || !Number.isFinite(exp) || exp * 1000 < Date.now()) {
    return false;
  }
  const expected = sign(storageKey, exp);
  try {
    const actual = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (actual.length === 0 || actual.length !== expectedBuf.length) {
      return false;
    }
    return timingSafeEqual(actual, expectedBuf);
  } catch {
    return false;
  }
}

/** Keys are `${cuid}${ext}`; anything else (paths, LIKE wildcards) is rejected. */
export function safeStorageKey(value: string): string | null {
  return /^[A-Za-z0-9]{1,64}(\.[A-Za-z0-9]{1,8})?$/.test(value) ? value : null;
}

export const chatUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, file, cb) => {
      const ext = extensionForMime(file.mimetype) ?? "";
      cb(null, `${createId()}${ext}`);
    },
  }),
  limits: { fileSize: 40 * 1024 * 1024, files: 1, fields: 8 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedMime(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("This file type is not allowed"));
  },
});
