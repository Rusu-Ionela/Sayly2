import type {
  CreateVoiceSparkInput,
  FlashQuestDto,
  RadarDto,
  VoiceSparkDto,
  VoiceSparkFeedDto,
} from "@sayly/shared";

import { uploadChatFile } from "@/features/chat/api/chatApi";
import { apiClient } from "@/lib/apiClient";

export function getRadar() {
  return apiClient.get<RadarDto>("/discover/radar");
}

export function getVoiceSparkFeed() {
  return apiClient.get<VoiceSparkFeedDto>("/voicesparks/feed");
}

export type RecordedNote = { uri: string; mimeType: string; fileName: string; durationMs: number };

/** Uploads the recording, then posts it as a spark (or as a voice reply with `replyToId`). */
export async function postVoiceSpark(
  note: RecordedNote,
  languageId: string,
  replyToId?: string,
): Promise<VoiceSparkDto> {
  const upload = await uploadChatFile(note.uri, note.mimeType, note.fileName);
  const input: CreateVoiceSparkInput = {
    audioUrl: upload.url,
    durationMs: note.durationMs,
    languageId,
    ...(replyToId ? { replyToId } : {}),
  };
  return apiClient.post<VoiceSparkDto>("/voicesparks", input);
}

export function deleteVoiceSpark(sparkId: string) {
  return apiClient.delete<{ deleted: boolean }>(`/voicesparks/${encodeURIComponent(sparkId)}`);
}

const questPath = (questId: string) => `/matchmaking/flash-quest/${encodeURIComponent(questId)}`;

export function startFlashQuest(languageId: string) {
  return apiClient.post<FlashQuestDto>("/matchmaking/flash-quest", { languageId });
}

export function getFlashQuest(questId: string) {
  return apiClient.get<FlashQuestDto>(questPath(questId));
}

export function leaveFlashQuest(questId: string) {
  return apiClient.delete<FlashQuestDto>(questPath(questId));
}

export function sendFlashQuestMessage(questId: string, body: string) {
  return apiClient.post<FlashQuestDto>(`${questPath(questId)}/messages`, { body });
}

export function connectAfterFlashQuest(questId: string) {
  return apiClient.post<FlashQuestDto>(`${questPath(questId)}/connect`);
}
