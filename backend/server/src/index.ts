import "dotenv/config";

import { createServer } from "http";

import { closeDb } from "./db/client";
import { pruneExpiredTokens } from "./features/auth/repository";
import { env } from "./config/env";
import { pruneOldFlashQuests } from "./features/flashQuests";
import { pruneOldInbox } from "./features/notifications";
import { startWeeklyRewardJob } from "./features/leaderboard";
import { startStreakReminderJob } from "./features/streaks/reminders";
import { startStoryCleanupJob } from "./features/stories";
import { startVoiceSparkCleanupJob } from "./features/voiceSparks";
import { closeRedis, connectRedis } from "./infra/redis/client";
import { createApp, setDraining } from "./lib/app";
import { createSocketServer } from "./lib/socket";
import { subscribeToRevocation } from "./lib/sessionRevocation";
import { logger } from "./shared/utils/logger";

async function main() {
  await connectRedis();
  await subscribeToRevocation();

  // Expired token rows and old inbox items are useless; sweep them at start and then daily.
  const pruneTokens = () =>
    Promise.all([pruneExpiredTokens(), pruneOldInbox(), pruneOldFlashQuests()]).catch((error: unknown) =>
      logger.warn("auth", "token prune failed", {
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
  void pruneTokens();
  setInterval(() => void pruneTokens(), 24 * 60 * 60 * 1000).unref();

  const stopStreakReminders = startStreakReminderJob();
  const stopWeeklyRewards = startWeeklyRewardJob();
  const stopVoiceSparkCleanup = startVoiceSparkCleanupJob();
  const stopStoryCleanup = startStoryCleanupJob();

  const app = createApp();
  const httpServer = createServer(app);
  const io = await createSocketServer(httpServer);

  httpServer.listen(env.port, "0.0.0.0", () => {
    logger.info("server", "API listening", {
      port: env.port,
      nodeEnv: env.nodeEnv,
      urls: [`http://localhost:${env.port}`, `http://0.0.0.0:${env.port}`],
      clientOrigin: env.clientOrigin,
      swagger: env.enableSwagger ? env.swaggerPath : "disabled",
      uploadsDir: env.uploadsDir,
      redis: env.useMemoryRedis ? "memory" : "configured",
    });
  });

  httpServer.on("error", (error) => {
    logger.error("server", "listen failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    process.exit(1);
  });

  let shuttingDown = false;

  async function shutdown(signal: string) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    setDraining(true);
    logger.info("server", "shutting down", { signal });

    const force = setTimeout(() => {
      logger.error("server", "shutdown timed out");
      process.exit(1);
    }, 10_000);
    force.unref();

    stopStreakReminders();
    stopWeeklyRewards();
    stopVoiceSparkCleanup();
    stopStoryCleanup();
    io.close();
    httpServer.close(async () => {
      try {
        await closeRedis();
      } catch (error) {
        logger.error("server", "redis close failed", {
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
      try {
        await closeDb();
      } catch (error) {
        logger.error("server", "database close failed", {
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

void main().catch((error) => {
  logger.error("server", "startup failed", {
    message: error instanceof Error ? error.message : "Unknown error",
  });
  process.exit(1);
});
