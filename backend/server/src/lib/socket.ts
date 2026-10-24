import type { Server as HttpServer } from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import { Server } from "socket.io";

import { env } from "../config/env";
import { findUserById } from "../features/auth/repository";
import { verifyAccessToken } from "../features/auth/tokens";
import { registerCallSockets } from "../features/calls";
import { attachMessagingGateway, registerMessagingSockets } from "../features/messaging";
import { userRoom } from "../features/messaging/gateway";
import { sweepStalePresence } from "../features/messaging/presence";
import { broadcastPresence } from "../features/messaging/presenceBroadcast";
import { persistLastSeen } from "../features/messaging/service";
import { consumeLimit, rateLimitPolicies, trustedClientIp } from "../infra/limiter/limiter";
import { getSocketAdapterClients, isRedisConfiguredForAdapter } from "../infra/redis/client";
import { AppError } from "../shared/errors/AppError";
import { logger } from "../shared/utils/logger";
import { setFamilySocketRevoker, setUserSocketRevoker } from "./sessionRevocation";

const allowedOrigins = new Set(env.clientOrigins);

function extractSocketToken(socket: { handshake: { auth?: Record<string, unknown>; headers: Record<string, unknown> } }) {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken) {
    return authToken;
  }

  const header = socket.handshake.headers.authorization;
  if (typeof header === "string" && /^Bearer /i.test(header)) {
    return header.slice(7);
  }

  return "";
}

/** Same rule as Express `trust proxy` in app.ts: in production, the last X-Forwarded-For hop. */
function handshakeIp(socket: { handshake: { address?: string; headers: Record<string, unknown> } }) {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  if (env.isProduction && typeof forwarded === "string") {
    const last = forwarded.split(",").pop()?.trim();
    if (last) {
      return trustedClientIp(last);
    }
  }
  return trustedClientIp(socket.handshake.address);
}

/** Returns the new expiry (ms) when the token belongs to the same user and session, else throws. */
export async function verifyReauthToken(
  data: { userId?: string; authVersion?: number; familyId?: string },
  token: unknown,
): Promise<number> {
  if (typeof token !== "string" || token.length > 8192) {
    throw new Error("Unauthorized");
  }
  const claims = await verifyAccessToken(token);
  if (
    claims.sub !== data.userId ||
    claims.authVersion !== data.authVersion ||
    claims.familyId !== data.familyId
  ) {
    throw new Error("Unauthorized");
  }
  return claims.exp * 1000;
}

export async function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        callback(null, !origin || allowedOrigins.has(origin));
      },
      credentials: false,
    },
    transports: ["websocket", "polling"],
  });

  const adapterClients = getSocketAdapterClients();
  if (adapterClients && isRedisConfiguredForAdapter()) {
    io.adapter(
      createAdapter(adapterClients.pubClient, adapterClients.subClient, {
        key: `${env.redisKeyPrefix}:socket.io`,
        requestsTimeout: 5_000,
      }),
    );
    logger.info("socket", "redis adapter attached");
  } else {
    logger.warn("socket", "running without redis adapter; events stay on this process");
  }

  attachMessagingGateway(io);
  setUserSocketRevoker((userId) => {
    io.in(userRoom(userId)).disconnectSockets(true);
  });
  setFamilySocketRevoker((userId, familyId) => {
    void io
      .in(userRoom(userId))
      .fetchSockets()
      .then((sockets) => {
        for (const connected of sockets) {
          if (connected.data.familyId === familyId) {
            connected.disconnect(true);
          }
        }
      })
      .catch((error) => {
        logger.warn("socket", "family revocation fetch failed", {
          message: error instanceof Error ? error.message : "Unknown error",
        });
      });
  });

  io.use(async (socket, next) => {
    try {
      await consumeLimit(rateLimitPolicies.socketConnect, handshakeIp(socket));
      const token = extractSocketToken(socket);
      if (!token || token.length > 8192) {
        throw new Error("Unauthorized");
      }

      const claims = await verifyAccessToken(token);
      const user = await findUserById(claims.sub);
      if (!user || user.status !== "ACTIVE" || user.authVersion !== claims.authVersion) {
        throw new Error("Unauthorized");
      }

      socket.data.userId = user.id;
      socket.data.authVersion = user.authVersion;
      socket.data.expiresAtMs = claims.exp * 1000;
      socket.data.familyId = claims.familyId;
      socket.data.lastSessionCheckAt = Date.now();
      next();
    } catch (error) {
      if (error instanceof AppError && error.code === "RATE_LIMITED") {
        next(new Error("RATE_LIMITED"));
        return;
      }
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const expiresAtMs = Number(socket.data.expiresAtMs ?? 0);
    const ttl = expiresAtMs - Date.now();
    if (ttl <= 0) {
      socket.disconnect(true);
      return;
    }

    let timer = setTimeout(() => {
      socket.disconnect(true);
    }, ttl);
    socket.on("disconnect", () => clearTimeout(timer));

    // Lets a live connection (and any call on it) carry on past its first access token.
    socket.on("reauth", async (payload: unknown, ack?: (result: { ok: boolean }) => void) => {
      try {
        await consumeLimit(rateLimitPolicies.socketJoin, String(socket.data.userId));
        socket.data.expiresAtMs = await verifyReauthToken(socket.data, (payload as { token?: unknown } | null)?.token);
        clearTimeout(timer);
        timer = setTimeout(() => socket.disconnect(true), socket.data.expiresAtMs - Date.now());
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
      }
    });

    registerMessagingSockets(io, socket);
    registerCallSockets(socket);
  });

  io.engine.on("connection_error", (error) => {
    logger.warn("socket", "connection error", { message: error.message });
  });

  const sweeper = setInterval(() => {
    void sweepStalePresence()
      .then(async (offlineUsers) => {
        for (const item of offlineUsers) {
          await persistLastSeen(item.userId, item.lastSeen);
          await broadcastPresence(item.userId, item.lastSeen);
        }
      })
      .catch((error) => {
        logger.warn("presence", "sweeper failed", {
          message: error instanceof Error ? error.message : "Unknown error",
        });
      });
  }, 5_000);
  sweeper.unref();

  return io;
}
