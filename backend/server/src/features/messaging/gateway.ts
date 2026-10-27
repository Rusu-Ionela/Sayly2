import type { Server } from "socket.io";

import type {
  ChatMessage,
  MessageCorrectedEvent,
  MessageStatusEvent,
  UserOnlineStatusEvent,
} from "./types";

let io: Server | null = null;

export function attachMessagingGateway(server: Server) {
  io = server;
}

export function getMessagingIo() {
  return io;
}

export function userRoom(userId: string) {
  return `user:${userId}`;
}

export function conversationRoom(conversationId: string) {
  return `conversation:${conversationId}`;
}

/** Fan-out to each user's personal room — membership is re-read per event, so removed users stop receiving. */
export function emitToUsers(userIds: string[], event: string, payload: unknown) {
  const server = getMessagingIo();
  if (!server || userIds.length === 0) return;
  server.to([...new Set(userIds)].map(userRoom)).emit(event, payload);
}

/** Reaches a user's other devices, but not the socket that triggered the event. */
export function emitToUserExceptSocket(userId: string, socketId: string, event: string, payload: unknown) {
  const server = getMessagingIo();
  if (!server) return;
  server.to(userRoom(userId)).except(socketId).emit(event, payload);
}

export function emitNewMessage(message: ChatMessage, recipientId: string) {
  const server = getMessagingIo();
  if (!server) return;

  // Socket.IO treats an array of rooms as a union, so overlapping membership is not duplicated.
  server
    .to([conversationRoom(message.conversationId), userRoom(message.senderId), userRoom(recipientId)])
    .emit("message_new", message);
}

/** Both participants see a correction at once, whether or not the chat is open. */
export function emitMessageCorrected(payload: MessageCorrectedEvent, participantIds: string[]) {
  const server = getMessagingIo();
  if (!server) return;

  server
    .to([conversationRoom(payload.conversationId), ...participantIds.map(userRoom)])
    .emit("message_corrected", payload);
}

export function emitMessageStatus(payload: MessageStatusEvent, extraUserIds: string[] = []) {
  const server = getMessagingIo();
  if (!server) return;

  server.to([conversationRoom(payload.conversationId), ...extraUserIds.map(userRoom)]).emit("message_status", payload);
}

export function emitTyping(
  conversationId: string,
  partnerId: string,
  senderId: string,
  kind: "typing_start" | "typing_stop",
) {
  const server = getMessagingIo();
  if (!server) return;

  const payload = { conversationId, userId: senderId };
  server
    .to([conversationRoom(conversationId), userRoom(partnerId)])
    .except(userRoom(senderId))
    .emit(kind, payload);
}

export function emitUserOnlineStatus(payload: UserOnlineStatusEvent, partnerIds: string[]) {
  const server = getMessagingIo();
  if (!server) return;

  for (const partnerId of partnerIds) {
    server.to(userRoom(partnerId)).emit("user_online_status", payload);
  }
}
