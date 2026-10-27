import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate";
import {
  mutationLimiter,
  messageSendLimiter,
  transcribeLimiter,
  translateLimiter,
} from "../../infra/limiter/middleware";
import * as controller from "./controller";

/** Mounted at /conversations (CHAT-001 / CHAT-002). */
export const conversationsRouter = Router();

conversationsRouter.get("/", authenticate, controller.listConversations);
conversationsRouter.post("/direct", authenticate, mutationLimiter, controller.openDirectConversation);
conversationsRouter.get("/:id/messages", authenticate, controller.listMessages);
conversationsRouter.post("/:id/messages", authenticate, messageSendLimiter, controller.sendMessage);
conversationsRouter.patch("/:id/read", authenticate, controller.markConversationRead);
conversationsRouter.put("/:id/pin", authenticate, mutationLimiter, controller.setPinned(true));
conversationsRouter.delete("/:id/pin", authenticate, mutationLimiter, controller.setPinned(false));
conversationsRouter.put("/:id/auto-translate", authenticate, mutationLimiter, controller.setAutoTranslate);
conversationsRouter.post(
  "/:id/messages/:messageId/translate",
  authenticate,
  translateLimiter,
  controller.translateMessage,
);
conversationsRouter.post(
  "/:id/messages/:messageId/transcribe",
  authenticate,
  transcribeLimiter,
  controller.transcribeMessage,
);
conversationsRouter.post(
  "/:id/messages/:messageId/corrections",
  authenticate,
  messageSendLimiter,
  controller.correctMessage,
);
conversationsRouter.get(
  "/:id/messages/:messageId/corrections",
  authenticate,
  controller.listMessageCorrections,
);

/** Mounted at /learning for saved phrases. */
export const learningRouter = Router();
learningRouter.get("/phrases", authenticate, controller.listSavedPhrases);
learningRouter.post("/phrases", authenticate, messageSendLimiter, controller.savePhrase);
learningRouter.delete("/phrases/:phraseId", authenticate, controller.deleteSavedPhrase);
learningRouter.get("/expressions", authenticate, controller.listExpressions);
