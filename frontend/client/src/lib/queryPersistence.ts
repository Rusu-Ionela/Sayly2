import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query } from "@tanstack/react-query";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import Constants from "expo-constants";

/** Kept on the phone so the app opens instantly and shows profile and chats offline. */
export const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Only data that makes sense to show offline is written to disk (first query-key segment).
 * Discovery, other people's profiles and search results are always fetched fresh.
 */
const PERSISTED_ROOTS = new Set([
  "profile",
  "conversations",
  "messages",
  "languages",
  "userLanguages",
  "streak",
  "icebreakers",
]);

export function shouldPersistQuery(query: Pick<Query, "queryKey" | "state">): boolean {
  const root = query.queryKey[0];
  return query.state.status === "success" && typeof root === "string" && PERSISTED_ROOTS.has(root);
}

const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "sayly-query-cache",
  // Write at most once a second while chats stream in.
  throttleTime: 1_000,
});

export const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister: queryPersister,
  maxAge: PERSIST_MAX_AGE_MS,
  // A new app version may change response shapes: start from an empty cache then.
  buster: Constants.expoConfig?.version ?? "dev",
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
};

/** Sign-out: the next person on this phone must never see the previous member's chats. */
export async function clearPersistedQueries() {
  await queryPersister.removeClient();
}
