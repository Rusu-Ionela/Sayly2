import type { Request, Response } from "express";

import { requireUserId } from "../../shared/middleware/requireUserId";

import * as inbox from "./inbox.repository";
import {
  inboxIdSchema,
  listInboxSchema,
  registerPushTokenSchema,
  unregisterPushTokenSchema,
} from "./schema";
import * as service from "./service";

/** POST /notifications/push-tokens — this device should receive the user's notifications. */
export async function registerPushToken(req: Request, res: Response) {
  const { token, platform } = registerPushTokenSchema.parse(req.body);
  await service.registerPushToken(requireUserId(req), token, platform);
  res.status(204).end();
}

/** DELETE /notifications/push-tokens/:token — sign-out on this device. */
export async function unregisterPushToken(req: Request, res: Response) {
  const { token } = unregisterPushTokenSchema.parse({ token: req.params.token });
  await service.unregisterPushToken(requireUserId(req), token);
  res.status(204).end();
}

/** GET /notifications?page= — newest first. */
export async function listInbox(req: Request, res: Response) {
  const { page } = listInboxSchema.parse(req.query);
  res.json(await inbox.listInbox(requireUserId(req), page));
}

/** GET /notifications/unread-count — drives the bell badge. */
export async function unreadCount(req: Request, res: Response) {
  res.json({ count: await inbox.countUnread(requireUserId(req)) });
}

/** PATCH /notifications/read-all */
export async function markAllRead(req: Request, res: Response) {
  await inbox.markAllRead(requireUserId(req));
  res.status(204).end();
}

/** PATCH /notifications/:id/read */
export async function markRead(req: Request, res: Response) {
  const { id } = inboxIdSchema.parse(req.params);
  await inbox.markRead(requireUserId(req), id);
  res.status(204).end();
}
