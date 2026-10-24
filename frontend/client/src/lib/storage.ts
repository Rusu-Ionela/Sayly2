/**
 * Storage adapters
 *
 * Auth secrets (access/refresh tokens):
 * - native: Expo SecureStore
 * - web: never stored here; authStorage keeps the access token in memory and the API
 *   sets the refresh token as an HttpOnly cookie.
 *
 * Non-sensitive preferences (theme, UI prefs): localStorage on web, SecureStore on native.
 */
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import { log } from "./logger";

type StorageAdapter = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

/**
 * iOS Keychain warns (and can fail the whole Expo Go launch) above 2048 bytes.
 * Always split by UTF-8 bytes, never write a value over the limit in one call.
 */
const MAX_BYTES = 1800;
const CHUNK_PREFIX = "__chunks__:";

function chunkKey(key: string, index: number) {
  return `${key}.${index}`;
}

function utf8Size(value: string): number {
  return new TextEncoder().encode(value).length;
}

function splitUtf8(value: string, maxBytes: number): string[] {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length <= maxBytes) {
    return [value];
  }

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let offset = 0;

  while (offset < bytes.length) {
    let end = Math.min(offset + maxBytes, bytes.length);
    while (end > offset) {
      const slice = bytes.subarray(offset, end);
      const text = decoder.decode(slice);
      if (utf8Size(text) === slice.length) {
        chunks.push(text);
        offset = end;
        break;
      }
      end -= 1;
    }
    if (end <= offset) {
      chunks.push(decoder.decode(bytes.subarray(offset, offset + 1)));
      offset += 1;
    }
  }

  return chunks;
}

async function deleteSecureItem(key: string): Promise<void> {
  try {
    const existing = await SecureStore.getItemAsync(key);

    if (existing?.startsWith(CHUNK_PREFIX)) {
      const count = Number(existing.slice(CHUNK_PREFIX.length));
      if (Number.isFinite(count) && count > 0) {
        await Promise.all(
          Array.from({ length: count }, (_, index) =>
            SecureStore.deleteItemAsync(chunkKey(key, index)),
          ),
        );
      }
    }

    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    log.warn("storage", "secure delete failed", {
      key,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

const secureStorage: StorageAdapter = {
  async get(key: string): Promise<string | null> {
    try {
      const value = await SecureStore.getItemAsync(key);
      if (!value) {
        return null;
      }

      if (!value.startsWith(CHUNK_PREFIX)) {
        return value;
      }

      const count = Number(value.slice(CHUNK_PREFIX.length));
      if (!Number.isFinite(count) || count < 1) {
        return null;
      }

      const parts = await Promise.all(
        Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index))),
      );

      if (parts.some((part) => part == null)) {
        return null;
      }

      return parts.join("");
    } catch (error) {
      log.warn("storage", "secure get failed", {
        key,
        message: error instanceof Error ? error.message : "unknown",
      });
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    await deleteSecureItem(key);

    const chunks = splitUtf8(value, MAX_BYTES);

    try {
      if (chunks.length === 1) {
        await SecureStore.setItemAsync(key, chunks[0]!);
        return;
      }

      // Write chunks first, then the manifest, so a crash mid-write cannot
      // leave a count that points at missing chunk keys.
      await Promise.all(
        chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, index), chunk)),
      );
      await SecureStore.setItemAsync(key, `${CHUNK_PREFIX}${chunks.length}`);
    } catch (error) {
      log.warn("storage", "secure set failed", {
        key,
        message: error instanceof Error ? error.message : "unknown",
      });
      await deleteSecureItem(key);
      throw error instanceof Error ? error : new Error("Failed to persist secure storage");
    }
  },

  delete: deleteSecureItem,
};

const webStorage: StorageAdapter = {
  get: async (key) => {
    if (typeof localStorage === "undefined") {
      return null;
    }
    return localStorage.getItem(key);
  },
  set: async (key, value) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
  },
  delete: async (key) => {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    }
  },
};

/** Default adapter for auth data. Web tokens are never written through it (see authStorage). */
const secureAuthStorage = Platform.OS === "web" ? webStorage : secureStorage;

/**
 * Non-sensitive preferences (theme, UI flags).
 * Web: localStorage. Native: SecureStore (no AsyncStorage in this app; values are tiny).
 */
export const preferencesStorage: StorageAdapter =
  Platform.OS === "web" ? webStorage : secureStorage;

export const storage = secureAuthStorage;
