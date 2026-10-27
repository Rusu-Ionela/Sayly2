import { FLASH_QUEST_EVENTS, type FlashQuestDto, type VoiceSparkDto } from "@sayly/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useSocketContext } from "@/features/chat/socket/SocketProvider";
import { queryKeys } from "@/lib/queryKeys";

import {
  connectAfterFlashQuest,
  deleteVoiceSpark,
  getFlashQuest,
  getRadar,
  getVoiceSparkFeed,
  leaveFlashQuest,
  postVoiceSpark,
  sendFlashQuestMessage,
  startFlashQuest,
  type RecordedNote,
} from "./api";
import { clockOffsetMs } from "./model";

const VOICE_SPARK_REPLY_EVENT = "voice_spark_reply";

/** Partners active in the last 15 minutes; refreshed every 30 s while the radar is open. */
export function useRadar(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.pulse.radar,
    queryFn: getRadar,
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled ? 30_000 : false,
  });
}

/** The Voice Sparks bar; a voice reply to one of my sparks refreshes it at once. */
export function useVoiceSparks() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocketContext();

  useEffect(() => {
    if (!socket || !isConnected) return;
    const onReply = (_reply: VoiceSparkDto) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pulse.sparks });
    };
    socket.on(VOICE_SPARK_REPLY_EVENT, onReply);
    return () => {
      socket.off(VOICE_SPARK_REPLY_EVENT, onReply);
    };
  }, [isConnected, queryClient, socket]);

  return useQuery({
    queryKey: queryKeys.pulse.sparks,
    queryFn: getVoiceSparkFeed,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function usePostVoiceSpark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      note,
      languageId,
      replyToId,
    }: {
      note: RecordedNote;
      languageId: string;
      replyToId?: string;
    }) => postVoiceSpark(note, languageId, replyToId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pulse.sparks });
      void queryClient.invalidateQueries({ queryKey: queryKeys.streak.me });
    },
  });
}

export function useDeleteVoiceSpark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteVoiceSpark,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.pulse.sparks }),
  });
}

export type QuestState = { quest: FlashQuestDto; offsetMs: number };

function withOffset(quest: FlashQuestDto): QuestState {
  return { quest, offsetMs: clockOffsetMs(quest, Date.now()) };
}

/** Polls fast while searching, slowly while the timer runs (the socket pushes changes). */
function pollInterval(state: QuestState | undefined): number | false {
  switch (state?.quest.status) {
    case "SEARCHING":
      return 3_000;
    case "ACTIVE":
      return 8_000;
    case "ENDED":
      return state.quest.connected ? false : 10_000;
    default:
      return false;
  }
}

/** One Flash Quest, kept live by socket pushes and a polling fallback. */
export function useFlashQuest(questId: string | null) {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocketContext();

  useEffect(() => {
    if (!socket || !isConnected || !questId) return;
    const onUpdated = (quest: FlashQuestDto) => {
      if (quest.id === questId) {
        queryClient.setQueryData(queryKeys.pulse.quest(questId), withOffset(quest));
      }
    };
    socket.on(FLASH_QUEST_EVENTS.updated, onUpdated);
    return () => {
      socket.off(FLASH_QUEST_EVENTS.updated, onUpdated);
    };
  }, [isConnected, queryClient, questId, socket]);

  return useQuery({
    queryKey: queryKeys.pulse.quest(questId ?? ""),
    queryFn: async () => withOffset(await getFlashQuest(questId ?? "")),
    enabled: Boolean(questId),
    refetchInterval: (query) => pollInterval(query.state.data),
  });
}

/**
 * Start, chat, leave and "stay friends" for the quest screen. A search that pairs with
 * someone at once comes back ACTIVE; otherwise the quest query takes over the waiting.
 */
export function useFlashQuestActions(onQuest: (questId: string) => void) {
  const queryClient = useQueryClient();
  const onQuestRef = useRef(onQuest);
  onQuestRef.current = onQuest;

  const store = (quest: FlashQuestDto) => {
    queryClient.setQueryData(queryKeys.pulse.quest(quest.id), withOffset(quest));
  };

  const start = useMutation({
    mutationFn: startFlashQuest,
    onSuccess: (quest) => {
      store(quest);
      onQuestRef.current(quest.id);
    },
  });
  const send = useMutation({
    mutationFn: ({ questId, body }: { questId: string; body: string }) =>
      sendFlashQuestMessage(questId, body),
    onSuccess: store,
  });
  const leave = useMutation({ mutationFn: leaveFlashQuest, onSuccess: store });
  const connect = useMutation({
    mutationFn: connectAfterFlashQuest,
    onSuccess: (quest) => {
      store(quest);
      if (quest.connected) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.connections.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.streak.me });
      }
    },
  });

  return { start, send, leave, connect };
}
