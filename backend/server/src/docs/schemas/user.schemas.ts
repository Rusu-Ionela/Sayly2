import { z } from "zod";

export const UserSchema = z
  .object({
    id: z.string().meta({ example: "clx123abc" }),
    email: z.string().email().meta({ example: "learner@example.com" }),
    displayName: z.string().meta({ example: "Aryan" }),
    bio: z.string().meta({ example: "" }),
    photoUrl: z.string().nullable().meta({ example: null }),
    emailVerifiedAt: z.string().datetime().nullable().meta({ example: null }),
    status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]),
    role: z.enum(["USER", "ADMIN"]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: "User" });

export const AuthResponseSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    user: UserSchema,
  })
  .meta({ id: "AuthResponse" });

export const MeResponseSchema = z
  .object({
    user: UserSchema,
  })
  .meta({ id: "MeResponse" });

export const LogoutResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .meta({ id: "LogoutResponse" });
