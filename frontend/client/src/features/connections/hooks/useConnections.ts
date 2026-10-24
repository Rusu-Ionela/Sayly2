import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getConnection,
  listConnections,
  requestConnection,
  respondToConnection,
  type Connection,
} from "../api/connectionsApi";

const connectionKey = (userId: string) => ["connections", "with", userId] as const;
const connectionsKey = ["connections"] as const;

export function useConnection(userId: string, enabled = true) {
  return useQuery({
    queryKey: connectionKey(userId),
    queryFn: () => getConnection(userId),
    enabled: enabled && Boolean(userId),
    staleTime: 15_000,
  });
}

export function useConnections() {
  return useQuery({ queryKey: connectionsKey, queryFn: listConnections, staleTime: 15_000 });
}

export function useConnectionAction(userId: string) {
  const queryClient = useQueryClient();
  const update = (connection: Connection) => {
    queryClient.setQueryData(connectionKey(userId), connection);
    void queryClient.invalidateQueries({ queryKey: connectionsKey });
  };

  const request = useMutation({
    mutationFn: (introMessage?: string) => requestConnection(userId, introMessage),
    onSuccess: update,
  });
  const respond = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "ACCEPT" | "DECLINE" | "CANCEL" | "REMOVE" }) =>
      respondToConnection(id, action),
    onSuccess: update,
  });

  return { request, respond };
}

/** Starts a request from a discovery card, where the target varies per list item. */
export function useRequestConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, introMessage }: { userId: string; introMessage?: string }) =>
      requestConnection(userId, introMessage),
    onSuccess: (connection, variables) => {
      queryClient.setQueryData(connectionKey(variables.userId), connection);
      void queryClient.invalidateQueries({ queryKey: connectionsKey });
    },
  });
}
