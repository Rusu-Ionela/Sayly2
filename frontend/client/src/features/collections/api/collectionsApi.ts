import { apiClient } from "@/lib/apiClient";

/** A Collection entry: a line saved from chat, or an expression from the catalog. */
export type SavedPhrase = {
  id: string;
  sourceText: string;
  correctedText: string | null;
  /** Meaning (catalog) or your own note (chat). */
  note: string | null;
  example: string | null;
  /** Set when saved from the expressions catalog. */
  expressionId: string | null;
  messageId: string | null;
  languageCode: string | null;
  createdAt: string;
};

export type Expression = {
  id: string;
  languageCode: string;
  phrase: string;
  meaning: string;
  example: string;
  /** Collection entry id when you already saved it. */
  savedPhraseId: string | null;
};

export type ExpressionsResponse = {
  /** Languages that have curated expressions. */
  languages: string[];
  items: Expression[];
};

export type SaveChatPhraseInput = {
  sourceText: string;
  correctedText?: string;
  note?: string;
  messageId?: string;
  languageCode?: string;
};

export function listSavedPhrases() {
  return apiClient.get<{ items: SavedPhrase[] }>("/learning/phrases");
}

/** From chat (text) or from the catalog (`{ expressionId }`, idempotent). */
export function savePhrase(input: SaveChatPhraseInput | { expressionId: string }) {
  return apiClient.post<SavedPhrase>("/learning/phrases", input);
}

export function deleteSavedPhrase(phraseId: string) {
  return apiClient.delete<void>(`/learning/phrases/${encodeURIComponent(phraseId)}`);
}

/** Without `language`: expressions in every language you are learning. */
export function listExpressions(language?: string) {
  const query = language ? `?language=${encodeURIComponent(language)}` : "";
  return apiClient.get<ExpressionsResponse>(`/learning/expressions${query}`);
}
