import { apiClient } from "@/lib/apiClient";

export type ConversationTopic = {
  id: string;
  title: string;
  isMain: boolean;
  createdAt: string;
};

/** Every topics endpoint answers with the full, ordered list (main topic first). */
export type ConversationTopics = {
  items: ConversationTopic[];
  max: number;
};

export function listTopics() {
  return apiClient.get<ConversationTopics>("/topics");
}

export function createTopic(input: { title: string; isMain?: boolean }) {
  return apiClient.post<ConversationTopics>("/topics", input);
}

export function setMainTopic(topicId: string) {
  return apiClient.patch<ConversationTopics>(`/topics/${encodeURIComponent(topicId)}`, {
    isMain: true,
  });
}

export function deleteTopic(topicId: string) {
  return apiClient.delete<ConversationTopics>(`/topics/${encodeURIComponent(topicId)}`);
}
