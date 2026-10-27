import { type CreateTopicInput, MAX_CONVERSATION_TOPICS } from "@sayly/shared";
import * as topicsRepository from "./repository";
import type { ConversationTopicsDto } from "./types";

/** Every write returns the full list so the client replaces one cache entry. */
export async function listTopics(userId: string): Promise<ConversationTopicsDto> {
  const rows = await topicsRepository.listTopics(userId);
  return { items: rows.map(topicsRepository.toTopicDto), max: MAX_CONVERSATION_TOPICS };
}

export async function createTopic(userId: string, input: CreateTopicInput) {
  await topicsRepository.createTopic(userId, input, MAX_CONVERSATION_TOPICS);
  return listTopics(userId);
}

export async function setMainTopic(userId: string, topicId: string) {
  await topicsRepository.setMainTopic(userId, topicId);
  return listTopics(userId);
}

export async function deleteTopic(userId: string, topicId: string) {
  await topicsRepository.deleteTopic(userId, topicId);
  return listTopics(userId);
}
