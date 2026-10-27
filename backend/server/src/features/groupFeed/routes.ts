import { Router } from "express";

import { groupActionLimiter, messageSendLimiter } from "../../infra/limiter/middleware";
import { authenticate } from "../../shared/middleware/authenticate";

import * as controller from "./controller";

/**
 * Mounted at /groups/:id/posts. Members-only; live updates go out as `group_post_*` socket
 * events to every active member (see GROUP_FEED_EVENTS).
 */
export const groupFeedRouter = Router({ mergeParams: true });

groupFeedRouter.get("/", authenticate, controller.listPosts);
groupFeedRouter.post("/", authenticate, messageSendLimiter, controller.createPost);
groupFeedRouter.get("/:postId", authenticate, controller.getPost);
groupFeedRouter.delete("/:postId", authenticate, groupActionLimiter, controller.deletePost);
groupFeedRouter.put("/:postId/reaction", authenticate, groupActionLimiter, controller.setReaction);
groupFeedRouter.delete("/:postId/reaction", authenticate, groupActionLimiter, controller.clearReaction);
groupFeedRouter.get("/:postId/comments", authenticate, controller.listComments);
groupFeedRouter.post("/:postId/comments", authenticate, messageSendLimiter, controller.createComment);
groupFeedRouter.delete("/:postId/comments/:commentId", authenticate, groupActionLimiter, controller.deleteComment);
