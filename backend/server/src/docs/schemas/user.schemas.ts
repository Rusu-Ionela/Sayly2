import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const UserSchema = z
  .object({
    id: z.string().openapi({ example: "clx123abc" }),
    email: z.string().email().openapi({ example: "learner@example.com" }),
    displayName: z.string().openapi({ example: "Aryan" }),
    bio: z.string().openapi({ example: "" }),
    photoUrl: z.string().nullable().openapi({ example: null }),
    emailVerifiedAt: z.string().datetime().nullable().openapi({ example: null }),
    status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]),
    role: z.enum(["USER", "ADMIN"]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("User");

export const AuthResponseSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    user: UserSchema,
  })
  .openapi("AuthResponse");

export const MeResponseSchema = z
  .object({
    user: UserSchema,
  })
  .openapi("MeResponse");

export const LogoutResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .openapi("LogoutResponse");
