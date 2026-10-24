import { z } from "zod";

export const uploadMetaSchema = z.object({
  kind: z.enum(["avatar", "chat"]),
  contentType: z.string().min(1),
});
