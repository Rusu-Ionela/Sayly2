import { Router } from "express";

import { groupActionLimiter, groupCreateLimiter, messageSendLimiter } from "../../infra/limiter/middleware";
import { authenticate } from "../../shared/middleware/authenticate";
import { groupFeedRouter } from "../groupFeed";
import * as controller from "./controller";

/** Mounted at /groups. Every rule is enforced server-side in policy.ts. */
export const groupsRouter = Router();

groupsRouter.get("/", authenticate, controller.listGroups);
groupsRouter.post("/", authenticate, groupCreateLimiter, controller.createGroup);
groupsRouter.get("/:id", authenticate, controller.getGroup);
groupsRouter.patch("/:id", authenticate, groupActionLimiter, controller.updateGroup);
groupsRouter.delete("/:id", authenticate, groupActionLimiter, controller.deleteGroup);
groupsRouter.post("/:id/join", authenticate, groupActionLimiter, controller.joinGroup);
groupsRouter.post("/:id/leave", authenticate, groupActionLimiter, controller.leaveGroup);
groupsRouter.post("/:id/transfer", authenticate, groupActionLimiter, controller.transferOwnership);
groupsRouter.get("/:id/members", authenticate, controller.listMembers);
groupsRouter.post("/:id/members/:userId/approve", authenticate, groupActionLimiter, controller.approveMember);
groupsRouter.patch("/:id/members/:userId", authenticate, groupActionLimiter, controller.changeRole);
groupsRouter.delete("/:id/members/:userId", authenticate, groupActionLimiter, controller.removeMember);
groupsRouter.get("/:id/messages", authenticate, controller.listMessages);
groupsRouter.post("/:id/messages", authenticate, messageSendLimiter, controller.sendMessage);
groupsRouter.patch("/:id/read", authenticate, controller.markRead);

// Feed: posts, comments and reactions (features/groupFeed).
groupsRouter.use("/:id/posts", groupFeedRouter);
