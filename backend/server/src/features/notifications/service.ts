import {
  CONNECTION_EVENTS,
  PUSH_CHANNELS,
  type ConnectionEventDto,
  type PushData,
} from "@sayly/shared";

import { logger } from "../../shared/utils/logger";
import { emitToUsers } from "../messaging/gateway";
import type { ChatMessage, MessageCorrectionDto } from "../messaging/types";

import { recordCorrection } from "./inbox";
import { sendExpoPush, type PushMessage } from "./expoPush";
import * as repository from "./repository";
import type { PushPlatform } from "./types";

type PushContent = Pick<PushMessage, "title" | "body"> & { data: PushData };

const MAX_PREVIEW = 140;

function logFailure(what: string) {
  return (error: unknown) =>
    logger.warn("notifications", `${what} failed`, {
      message: error instanceof Error ? error.message : "Unknown error",
    });
}

/** Sends one notification to every device of the user and forgets dead devices. */
async function pushToUser(userId: string, content: PushContent) {
  const tokens = await repository.pushTokensOf(userId);
  if (tokens.length === 0) return;
  const dead = await sendExpoPush(
    tokens.map((to) => ({ ...content, to, sound: "default", channelId: PUSH_CHANNELS.default })),
  );
  await repository.deletePushTokens(dead);
}

/** The evening nudge: the streak ends at midnight unless today gets some practice. */
export function streakReminderContent(currentStreak: number): Pick<PushMessage, "title" | "body"> {
  const days = currentStreak === 1 ? "1-day" : `${currentStreak}-day`;
  return {
    title: `🔥 Keep your ${days} streak`,
    body: "Send a message or answer today's icebreaker before midnight.",
  };
}

/**
 * Streak reminders for members the job already claimed (so each gets at most one a day),
 * sent in Expo's batches of 100. Returns how many devices were addressed.
 */
export async function sendStreakReminders(
  members: { userId: string; currentStreak: number }[],
): Promise<number> {
  const streakOf = new Map(members.map((member) => [member.userId, member.currentStreak]));
  const devices = await repository.pushTokensOfMany([...streakOf.keys()]);
  const data: PushData = { type: "streak_reminder" };
  const dead = await sendExpoPush(
    devices.map(({ userId, token }) => ({
      ...streakReminderContent(streakOf.get(userId) ?? 1),
      data,
      to: token,
      sound: "default",
      channelId: PUSH_CHANNELS.reminders,
    })),
  );
  await repository.deletePushTokens(dead);
  return devices.length;
}

/** What the lock screen shows for a chat message. */
export function messagePreview(message: Pick<ChatMessage, "type" | "content" | "caption">) {
  switch (message.type) {
    case "IMAGE":
      return message.caption?.trim() || "📷 Photo";
    case "VOICE":
      return "🎤 Voice message";
    case "VIDEO":
      return message.caption?.trim() || "🎥 Video";
    default: {
      const text = message.content.trim();
      return text.length > MAX_PREVIEW ? `${text.slice(0, MAX_PREVIEW - 1)}…` : text;
    }
  }
}

/** New chat message: push to the recipient's phones (the socket event is sent separately). */
export function notifyNewMessage(message: ChatMessage, recipientId: string) {
  void (async () => {
    const prefs = await repository.notificationPreferencesOf(recipientId);
    if (!prefs.notifyMessages) return;
    const senderName = await repository.displayNameOf(message.senderId);
    await pushToUser(recipientId, {
      title: senderName,
      body: messagePreview(message),
      data: { type: "message", conversationId: message.conversationId },
    });
  })().catch(logFailure("message notification"));
}

/** A partner corrected your message: push it to you (respects "Messages" in Settings). */
export function notifyCorrection(
  correction: MessageCorrectionDto,
  messageSenderId: string,
  conversationId: string,
) {
  recordCorrection(correction.id, correction.authorId, messageSenderId, conversationId);
  void (async () => {
    const prefs = await repository.notificationPreferencesOf(messageSenderId);
    if (!prefs.notifyMessages) return;
    const authorName = await repository.displayNameOf(correction.authorId);
    await pushToUser(messageSenderId, {
      title: `${authorName} suggested a correction`,
      body: messagePreview({ type: "TEXT", content: correction.correctedText, caption: null }),
      data: { type: "message", conversationId },
    });
  })().catch(logFailure("correction notification"));
}

/** Live event to the member's open apps (web included); the app applies their preferences. */
function emitConnectionEvent(
  toUserId: string,
  event: (typeof CONNECTION_EVENTS)[keyof typeof CONNECTION_EVENTS],
  other: ConnectionEventDto,
) {
  emitToUsers([toUserId], event, other);
}

/**
 * New partner request: a live event to the recipient's open apps, and a push to their phones
 * when they opted into connection notifications.
 */
export function notifyConnectionRequest(requesterId: string, recipientId: string) {
  void (async () => {
    const [prefs, requesterName] = await Promise.all([
      repository.notificationPreferencesOf(recipientId),
      repository.displayNameOf(requesterId),
    ]);
    emitConnectionEvent(recipientId, CONNECTION_EVENTS.request, {
      userId: requesterId,
      displayName: requesterName,
    });
    if (!prefs.notifyConnectionRequests) return;
    await pushToUser(recipientId, {
      title: "New connection request",
      body: `${requesterName} would like to practise with you.`,
      data: { type: "connection_request", userId: requesterId },
    });
  })().catch(logFailure("connection request notification"));
}

/** Tell both sides when a relationship becomes active (including a crossed request). */
export function notifyConnectionAccepted(requesterId: string, recipientId: string) {
  void (async () => {
    const [requesterPrefs, recipientPrefs, requesterName, recipientName] = await Promise.all([
      repository.notificationPreferencesOf(requesterId),
      repository.notificationPreferencesOf(recipientId),
      repository.displayNameOf(requesterId),
      repository.displayNameOf(recipientId),
    ]);
    emitConnectionEvent(requesterId, CONNECTION_EVENTS.accepted, {
      userId: recipientId,
      displayName: recipientName,
    });
    emitConnectionEvent(recipientId, CONNECTION_EVENTS.accepted, {
      userId: requesterId,
      displayName: requesterName,
    });
    await Promise.all([
      requesterPrefs.notifyConnectionRequests
        ? pushToUser(requesterId, {
            title: "Connection accepted",
            body: `${recipientName} accepted your request. You can now chat and call.`,
            data: { type: "connection_accepted", userId: recipientId },
          })
        : undefined,
      recipientPrefs.notifyConnectionRequests
        ? pushToUser(recipientId, {
            title: "You’re connected",
            body: `You and ${requesterName} can now chat and call.`,
            data: { type: "connection_accepted", userId: requesterId },
          })
        : undefined,
    ]);
  })().catch(logFailure("connection accepted notification"));
}

export function registerPushToken(userId: string, token: string, platform: PushPlatform) {
  return repository.savePushToken(userId, token, platform);
}

export function unregisterPushToken(userId: string, token: string) {
  return repository.removePushToken(userId, token);
}
