import type { Server, Socket } from "socket.io";

import { env } from "../../config/env";
import { consumeLimit, rateLimitPolicies } from "../../infra/limiter/limiter";
import { AppError } from "../../shared/errors/AppError";
import { logger } from "../../shared/utils/logger";
import { findUserById } from "../auth/repository";
import {
  conversationIdEventSchema,
  messageReadEventSchema,
  sendMessageEventSchema,
  userOnlineStatusEventSchema,
} from "./schema";
import { notifyNewMessage } from "../notifications";
import * as messagingService from "./service";
import {
  conversationRoom,
  emitMessageStatus,
  emitNewMessage,
  emitTyping,
  userRoom,
} from "./gateway";
import {
  getPresence,
  isOnline,
  markOffline,
  markOnline,
  refreshOnline,
} from "./presence";
import { broadcastPresence } from "./presenceBroadcast";

export type AuthedSocket = Socket & {
  data: {
    userId: string;
    authVersion?: number;
    expiresAtMs?: number;
    familyId?: string;
    lastSessionCheckAt?: number;
  };
};
export type AckFn = (payload: {
  ok: boolean;
  error?: string;
  code?: string;
  retryAfterMs?: number;
  [key: string]: unknown;
}) => void;

function runBackground(name: string, task: Promise<unknown>) {
  void task.catch((error) =>
    logger.error("socket", name, {
      message: error instanceof Error ? error.message : "Unknown error",
    }),
  );
}

export async function assertLiveSession(authed: AuthedSocket, force = false) {
  if (Date.now() >= Number(authed.data.expiresAtMs ?? 0)) {
    authed.disconnect(true);
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  }

  const due =
    force ||
    Date.now() - Number(authed.data.lastSessionCheckAt ?? 0) >= env.sessionRecheckMs;
  if (!due) {
    return;
  }

  const user = await findUserById(authed.data.userId);
  if (!user || user.status !== "ACTIVE" || user.authVersion !== authed.data.authVersion) {
    authed.disconnect(true);
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  }
  authed.data.lastSessionCheckAt = Date.now();
}

export function ackOk(ack: AckFn | undefined, extra: Record<string, unknown> = {}) {
  if (typeof ack === "function") ack({ ok: true, ...extra });
}

export function fail(authed: AuthedSocket, ack: AckFn | undefined, error: unknown, fallback: string) {
  const message = error instanceof AppError ? error.message : fallback;
  const code = error instanceof AppError ? error.code : "INTERNAL_ERROR";
  const retryAfterMs =
    error instanceof AppError && error.retryAfterSeconds
      ? error.retryAfterSeconds * 1000
      : undefined;
  if (typeof ack === "function") ack({ ok: false, error: message, code, retryAfterMs });
  authed.emit("message_error", { error: message, code, retryAfterMs });
}

export async function promoteDelivered(
  senderId: string,
  recipientId: string,
  conversationId: string,
  messageId: string,
) {
  try {
    if (!(await isOnline(recipientId))) {
      return;
    }

    const delivered = await messagingService.markMessagesDelivered([messageId]);
    const message = delivered[0];
    if (!message) {
      return;
    }

    emitMessageStatus({ conversationId, messages: [message] }, [senderId]);
  } catch {
    // Delivery receipts are best-effort and must not delay the send path.
  }
}

/** Turns messages that waited for this user into DELIVERED and tells each sender. */
export async function deliverPendingMessages(recipientId: string) {
  const delivered = await messagingService.markPendingDelivered(recipientId);
  const byConversation = new Map<string, { senderIds: Set<string>; messages: typeof delivered }>();
  for (const message of delivered) {
    const group = byConversation.get(message.conversationId) ?? { senderIds: new Set(), messages: [] };
    group.senderIds.add(message.senderId);
    group.messages.push(message);
    byConversation.set(message.conversationId, group);
  }
  for (const [conversationId, group] of byConversation) {
    emitMessageStatus({ conversationId, messages: group.messages }, [...group.senderIds]);
  }
}

export function registerMessagingSockets(_io: Server, socket: Socket) {
  const userId = socket.data.userId as string | undefined;
  if (!userId) {
    socket.emit("message_error", { error: "Unauthorized", code: "UNAUTHORIZED" });
    socket.disconnect(true);
    return;
  }

  const authed = socket as AuthedSocket;
  runBackground("presence lease failed", markOnline(userId, authed.id).then(() => broadcastPresence(userId)));
  void authed.join(userRoom(userId));
  runBackground("pending delivery failed", deliverPendingMessages(userId));

  const heartbeat = setInterval(() => {
    runBackground("presence heartbeat failed", refreshOnline(userId, authed.id).then((ok) => {
      if (!ok) {
        authed.disconnect(true);
      }
    }));
  }, env.presenceHeartbeatMs);
  heartbeat.unref();

  authed.on("join_conversation", async (payload: unknown, ack?: AckFn) => {
    try {
      const body = conversationIdEventSchema.parse(payload);
      await consumeLimit(rateLimitPolicies.socketJoin, userId);
      await assertLiveSession(authed);
      await messagingService.assertCanAccessConversation(body.conversationId, userId);
      await authed.join(conversationRoom(body.conversationId));
      ackOk(ack);
    } catch (error) {
      fail(authed, ack, error, "Failed to join conversation");
    }
  });

  authed.on("leave_conversation", async (payload: unknown, ack?: AckFn) => {
    try {
      const body = conversationIdEventSchema.parse(payload);
      await consumeLimit(rateLimitPolicies.socketJoin, userId);
      await assertLiveSession(authed);
      await messagingService.assertCanAccessConversation(body.conversationId, userId);
      await authed.leave(conversationRoom(body.conversationId));
      ackOk(ack);
    } catch (error) {
      fail(authed, ack, error, "Failed to leave conversation");
    }
  });

  authed.on("send_message", async (payload: unknown, ack?: AckFn) => {
    try {
      const body = sendMessageEventSchema.parse(payload);
      await consumeLimit(rateLimitPolicies.messageSend, userId);
      await assertLiveSession(authed, true);
      const result = await messagingService.sendMessage(userId, body);
      ackOk(ack, { message: result.message, created: result.created });
      if (result.created) {
        emitNewMessage(result.message, result.recipientId);
        notifyNewMessage(result.message, result.recipientId);
        runBackground(
          "delivery promotion failed",
          promoteDelivered(userId, result.recipientId, body.conversationId, result.message.id),
        );
      }
    } catch (error) {
      fail(authed, ack, error, "Failed to send message");
    }
  });

  authed.on("typing_start", async (payload: unknown, ack?: AckFn) => {
    try {
      const body = conversationIdEventSchema.parse(payload);
      await consumeLimit(rateLimitPolicies.typing, userId);
      await assertLiveSession(authed);
      const access = await messagingService.assertCanAccessConversation(body.conversationId, userId);
      emitTyping(body.conversationId, access.otherUserId, userId, "typing_start");
      ackOk(ack);
    } catch (error) {
      fail(authed, ack, error, "Failed to start typing");
    }
  });

  authed.on("typing_stop", async (payload: unknown, ack?: AckFn) => {
    try {
      const body = conversationIdEventSchema.parse(payload);
      // Do not rate-limit stop — clearing the indicator must always succeed.
      await assertLiveSession(authed);
      const access = await messagingService.assertCanAccessConversation(body.conversationId, userId);
      emitTyping(body.conversationId, access.otherUserId, userId, "typing_stop");
      ackOk(ack);
    } catch (error) {
      fail(authed, ack, error, "Failed to stop typing");
    }
  });

  authed.on("message_read", async (payload: unknown, ack?: AckFn) => {
    try {
      const body = messageReadEventSchema.parse(payload);
      await consumeLimit(rateLimitPolicies.messageRead, userId);
      await assertLiveSession(authed, true);
      const result = await messagingService.markMessagesRead(
        userId,
        body.conversationId,
        body.messageIds,
      );

      if (result.messages.length > 0) {
        emitMessageStatus({ conversationId: body.conversationId, messages: result.messages }, result.senderIds);
      }

      ackOk(ack, { messages: result.messages });
    } catch (error) {
      fail(authed, ack, error, "Failed to mark messages read");
    }
  });

  authed.on("user_online_status", async (payload: unknown, ack?: AckFn) => {
    try {
      const body = userOnlineStatusEventSchema.parse(payload);
      await consumeLimit(rateLimitPolicies.presenceQuery, userId);
      await assertLiveSession(authed);
      await messagingService.assertCanSeePresence(userId, body.userId);
      const status = { userId: body.userId, ...(await getPresence(body.userId)) };
      ackOk(ack, status);
      authed.emit("user_online_status", status);
    } catch (error) {
      fail(authed, ack, error, "Failed to load online status");
    }
  });

  authed.on("disconnect", () => {
    clearInterval(heartbeat);
    runBackground(
      "presence disconnect failed",
      markOffline(userId, authed.id).then(async (lastSeen) => {
        if (!lastSeen) {
          return;
        }
        await messagingService.persistLastSeen(userId, lastSeen);
        await broadcastPresence(userId);
      }),
    );
  });
}
