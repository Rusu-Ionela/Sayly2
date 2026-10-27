import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "../config/env";
import { checkDbReady } from "../db/client";
import { checkRedisReady } from "../infra/redis/client";
import { mountOpenApi } from "../docs/openapi";
import { authRouter } from "../features/auth";
import { certificatesRouter } from "../features/certificates";
import { connectionsRouter } from "../features/connections";
import { discoveryRouter } from "../features/discovery";
import { groupsRouter } from "../features/groups";
import { icebreakersRouter } from "../features/icebreakers";
import { languagesRouter } from "../features/languages";
import { leaderboardRouter } from "../features/leaderboard";
import { locationsRouter } from "../features/locations";
import { notificationsRouter } from "../features/notifications";
import { mediaRouter } from "../features/media";
import { conversationsRouter, learningRouter } from "../features/messaging";
import { callsRouter } from "../features/calls";
import { followsRouter } from "../features/follows";
import { matchmakingRouter } from "../features/flashQuests";
import { partyRoomsRouter } from "../features/partyRooms";
import { profileViewsRouter } from "../features/profileViews";
import { blocksRouter, reportsRouter } from "../features/safety";
import { streaksRouter } from "../features/streaks";
import { supportRouter } from "../features/support";
import { topicsRouter } from "../features/topics";
import { usersRouter } from "../features/users";
import { storiesRouter } from "../features/stories";
import { voiceSparksRouter } from "../features/voiceSparks";
import { errorHandler, notFoundHandler } from "../shared/middleware/errorHandler";
import { requestLogger } from "../shared/middleware/requestLogger";

const allowedOrigins = new Set(env.clientOrigins);
let draining = false;

export function setDraining(value: boolean) {
  draining = value;
}

export function createApp() {
  const app = express();

  // Production sits behind exactly one reverse proxy; elsewhere X-Forwarded-For is client-controlled.
  app.set("trust proxy", env.isProduction ? 1 : false);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
      },
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || allowedOrigins.has(origin));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type"],
      exposedHeaders: ["X-Request-Id"],
    }),
  );
  app.use(express.json({ limit: "5mb" }));
  app.use(requestLogger);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/ready", async (_req, res) => {
    if (draining) {
      res.status(503).json({ ok: false, reason: "draining" });
      return;
    }
    const dbReady = await checkDbReady();
    if (!dbReady) {
      res.status(503).json({ ok: false, reason: "database" });
      return;
    }
    const redisReady = await checkRedisReady();
    if (!redisReady) {
      res.status(503).json({ ok: false, reason: "redis" });
      return;
    }
    res.json({ ok: true });
  });

  mountOpenApi(app);

  app.use("/auth", authRouter);
  app.use("/users", usersRouter);
  app.use("/discover", discoveryRouter);
  app.use("/conversations", conversationsRouter);
  app.use("/groups", groupsRouter);
  app.use("/learning", learningRouter);
  app.use("/blocks", blocksRouter);
  app.use("/follows", followsRouter);
  app.use("/connections", connectionsRouter);
  app.use("/calls", callsRouter);
  app.use("/reports", reportsRouter);
  app.use("/languages", languagesRouter);
  app.use("/locations", locationsRouter);
  app.use("/notifications", notificationsRouter);
  app.use("/media", mediaRouter);
  app.use("/profile-views", profileViewsRouter);
  app.use("/topics", topicsRouter);
  app.use("/certificates", certificatesRouter);
  app.use("/support", supportRouter);
  app.use("/streaks", streaksRouter);
  app.use("/leaderboard", leaderboardRouter);
  app.use("/icebreakers", icebreakersRouter);
  app.use("/voicesparks", voiceSparksRouter);
  app.use("/stories", storiesRouter);
  app.use("/matchmaking", matchmakingRouter);
  app.use("/party-rooms", partyRoomsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
