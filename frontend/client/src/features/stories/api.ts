import type { CreateStoryInput, StoryDto, StoryFeedDto, StoryReplyResultDto } from "@sayly/shared";

import { uploadChatFile } from "@/features/chat/api/chatApi";
import { createClientMessageId } from "@/features/chat/model/clientMessageId";
import type { RecordedNote } from "@/features/pulse/api";
import { apiClient } from "@/lib/apiClient";

/** What the composer hands over; files are uploaded here before the story is posted. */
export type StoryDraft =
  | { kind: "TEXT"; text: string; targetLanguage: string }
  | { kind: "PHOTO"; uri: string; caption: string; targetLanguage: string }
  | { kind: "VOICE"; note: RecordedNote; targetLanguage: string };

export function getStoryFeed() {
  return apiClient.get<StoryFeedDto>("/stories/feed");
}

export async function postStory(draft: StoryDraft): Promise<StoryDto> {
  let input: CreateStoryInput;
  switch (draft.kind) {
    case "TEXT":
      input = { mediaType: "TEXT", textContent: draft.text, targetLanguage: draft.targetLanguage };
      break;
    case "PHOTO": {
      const upload = await uploadChatFile(draft.uri, "image/jpeg", "story.jpg");
      const caption = draft.caption.trim();
      input = {
        mediaType: "PHOTO",
        mediaUrl: upload.url,
        targetLanguage: draft.targetLanguage,
        ...(caption ? { textContent: caption } : {}),
      };
      break;
    }
    case "VOICE": {
      const upload = await uploadChatFile(draft.note.uri, draft.note.mimeType, draft.note.fileName);
      input = {
        mediaType: "VOICE",
        mediaUrl: upload.url,
        durationMs: draft.note.durationMs,
        targetLanguage: draft.targetLanguage,
      };
      break;
    }
  }
  return apiClient.post<StoryDto>("/stories", input);
}

export function replyToStory(storyId: string, text: string) {
  return apiClient.post<StoryReplyResultDto>(`/stories/${encodeURIComponent(storyId)}/reply`, {
    text,
    clientMessageId: createClientMessageId(),
  });
}

export function deleteStory(storyId: string) {
  return apiClient.delete<{ deleted: boolean }>(`/stories/${encodeURIComponent(storyId)}`);
}
