import { z } from "zod";

import { boundedIdSchema } from "../../shared/validation/text";

import { PUSH_PLATFORMS } from "./types";

/** Expo push tokens look like `ExponentPushToken[xxxxxxxx]`. */
const expoPushTokenSchema = z
  .string()
  .trim()
  .max(256)
  .regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/, "Invalid Expo push token");

export const registerPushTokenSchema = z
  .object({ token: expoPushTokenSchema, platform: z.enum(PUSH_PLATFORMS) })
  .strict();

export const unregisterPushTokenSchema = z.object({ token: expoPushTokenSchema }).strict();

export const listInboxSchema = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1) });

export const inboxIdSchema = z.object({ id: boundedIdSchema });
