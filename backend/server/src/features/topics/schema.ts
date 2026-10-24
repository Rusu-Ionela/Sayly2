import { z } from "zod";

import { singleLineTextSchema } from "../../shared/validation/text";

import type { CreateTopicInput } from "./types";

export const MAX_CONVERSATION_TOPICS = 10;
export const TOPIC_TITLE_MIN = 3;
export const TOPIC_TITLE_MAX = 80;

/** POST /topics */
export const createTopicSchema = z
  .object({
    title: singleLineTextSchema(TOPIC_TITLE_MIN, TOPIC_TITLE_MAX, "Topic"),
    isMain: z.boolean().optional(),
  })
  .strict() satisfies z.ZodType<CreateTopicInput>;

/** PATCH /topics/:topicId — the only change is promoting a topic to main. */
export const updateTopicSchema = z.object({ isMain: z.literal(true) }).strict();
