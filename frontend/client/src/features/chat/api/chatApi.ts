import { Platform } from "react-native";

import { apiClient } from "@/lib/apiClient";
import { toStableMediaPath } from "@/lib/mediaUrl";

import type {
  ChatMessage,
  ConversationsPage,
  Conversation,
  MessageCorrection,
  MessagesPage,
} from "../types";

export type MediaUploadResult = {
  /** Stable `/media/files/...` path to persist. */
  url: string;
  /** Short-lived signed URL — the only form an <Image> can load (it sends no auth header). */
  signedUrl?: string;
  mimeType: string;
  kind: "image" | "audio" | "video";
  size: number;
};

export type SendMessageBody = {
  content: string;
  type?: ChatMessage["type"];
  durationMs?: number;
  mimeType?: string;
  thumbnailUrl?: string;
  caption?: string;
  clientMessageId?: string;
};

type RequestOpts = { signal?: AbortSignal };

export async function getConversations(
  params: { cursor?: string; limit?: number } = {},
  opts: RequestOpts = {},
) {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 50));
  if (params.cursor) {
    search.set("cursor", params.cursor);
  }
  return apiClient.get<ConversationsPage | Conversation[]>(`/conversations?${search.toString()}`, {
    signal: opts.signal,
  });
}

export async function getConversationsPage(
  params: { cursor?: string; limit?: number } = {},
  opts: RequestOpts = {},
): Promise<ConversationsPage> {
  const page = await getConversations(params, opts);
  if (Array.isArray(page)) {
    return { items: page, nextCursor: null, hasMore: false, limit: params.limit ?? 50 };
  }
  return page;
}

export function getMessages(
  conversationId: string,
  params: { page?: number; before?: string; limit?: number } = {},
  opts: RequestOpts = {},
) {
  const search = new URLSearchParams();
  const limit = params.limit ?? 30;
  search.set("limit", String(limit));
  if (params.before) {
    search.set("before", params.before);
  } else if (params.page) {
    search.set("page", String(params.page));
  }

  return apiClient.get<MessagesPage>(
    `/conversations/${conversationId}/messages?${search.toString()}`,
    { signal: opts.signal },
  );
}

export function sendMessageHttp(conversationId: string, body: SendMessageBody) {
  return apiClient.post<ChatMessage>(`/conversations/${conversationId}/messages`, body);
}

export function markConversationReadHttp(conversationId: string) {
  return apiClient.patch<{ conversationId: string; readCount: number }>(
    `/conversations/${conversationId}/read`,
  );
}

export function setConversationPinnedHttp(conversationId: string, pinned: boolean) {
  const path = `/conversations/${conversationId}/pin`;
  return pinned
    ? apiClient.put<{ conversationId: string; pinned: boolean }>(path)
    : apiClient.delete<{ conversationId: string; pinned: boolean }>(path);
}

export function translateMessageHttp(
  conversationId: string,
  messageId: string,
  targetLang?: string,
) {
  return apiClient.post<ChatMessage>(
    `/conversations/${conversationId}/messages/${messageId}/translate`,
    targetLang ? { targetLang } : {},
  );
}

export function transcribeMessageHttp(conversationId: string, messageId: string) {
  return apiClient.post<ChatMessage>(
    `/conversations/${conversationId}/messages/${messageId}/transcribe`,
    {},
  );
}

export function correctMessageHttp(
  conversationId: string,
  messageId: string,
  correctedText: string,
  note?: string,
) {
  return apiClient.post<MessageCorrection>(
    `/conversations/${conversationId}/messages/${messageId}/corrections`,
    { correctedText, note },
  );
}

export async function uploadChatFile(uri: string, mimeType?: string, fileName?: string) {
  const form = new FormData();
  const { mime, name } = inferUploadMeta(uri, mimeType, fileName);

  if (Platform.OS === "web") {
    const blob = await fetch(uri).then((response) => response.blob());
    form.append("file", blob, name);
    if (uri.startsWith("blob:")) {
      URL.revokeObjectURL(uri);
    }
  } else {
    form.append("file", {
      uri,
      name,
      type: mime,
    } as unknown as Blob);
  }

  return apiClient.postForm<MediaUploadResult>("/media/uploads", form).then((result) => ({
    ...result,
    url: toStableMediaPath(result.url),
  }));
}

function inferUploadMeta(uri: string, mimeType?: string, fileName?: string) {
  const fromName = fileName || uri.split("?")[0]?.split("/").pop() || "upload";
  const decoded = decodeURIComponent(fromName);
  const ext = (
    decoded.includes(".") ? decoded.slice(decoded.lastIndexOf(".") + 1) : ""
  ).toLowerCase();
  const byExt: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
    m4a: "audio/mp4",
    aac: "audio/aac",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    webm: mimeType?.startsWith("video/") ? "video/webm" : "audio/webm",
    mp4: mimeType?.startsWith("audio/") ? "audio/mp4" : "video/mp4",
    mov: "video/quicktime",
    "3gp": "video/3gpp",
  };
  const mime =
    mimeType && mimeType !== "application/octet-stream"
      ? mimeType === "image/jpg"
        ? "image/jpeg"
        : mimeType
      : (byExt[ext] ?? "image/jpeg");
  const name = decoded.includes(".") ? decoded : `upload.${ext || "jpg"}`;
  return { mime, name };
}

export function openDirectConversation(userId: string) {
  return apiClient.post<{ conversationId: string }>("/conversations/direct", { userId });
}
