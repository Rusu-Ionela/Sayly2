import { API_BASE_URL } from "./apiClient";

/** Turn stored media paths into a URL this device can actually load. */
export function resolveMediaUrl(uri?: string | null): string | undefined {
  if (!uri) return undefined;
  if (
    uri.startsWith("data:") ||
    uri.startsWith("blob:") ||
    uri.startsWith("file:") ||
    uri.startsWith("content:") ||
    uri.startsWith("ph://") ||
    uri.startsWith("assets-library:")
  ) {
    return uri;
  }

  if (uri.startsWith("/")) {
    return `${API_BASE_URL}${uri}`;
  }

  try {
    const parsed = new URL(uri);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      const api = new URL(API_BASE_URL);
      parsed.protocol = api.protocol;
      parsed.host = api.host;
      return parsed.toString();
    }
  } catch {
    return uri;
  }

  return uri;
}

export function isUploadedMediaUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/media/");
}

/** Strip exp/sig so we persist durable media paths. */
export function toStableMediaPath(value: string): string {
  if (!value.includes("/media/files/")) {
    return value;
  }
  const marker = "/media/files/";
  const index = value.indexOf(marker);
  if (index === -1) {
    return value;
  }
  const pathOnly = value.slice(index).split("?")[0] ?? value;
  return pathOnly;
}
