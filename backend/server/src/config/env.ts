import "dotenv/config";
import path from "path";

import { z } from "zod";

const durationSchema = z
  .string()
  .regex(/^[1-9]\d*[smhd]$/, "Duration must be a positive value such as 15m or 30d");

const originSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === "http:" || url.protocol === "https:") && (url.pathname === "/" || url.pathname === "") && !url.search && !url.hash;
    } catch {
      return false;
    }
  }, "CLIENT_ORIGIN values must be exact http(s) origins without a path");

function parseOrigins(value: string): string[] {
  const origins = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => originSchema.parse(item.replace(/\/$/, "")));
  return [...new Set(origins)];
}

const nodeEnvSchema = z.enum(["development", "test", "production"]);

const envSchema = z
  .object({
    NODE_ENV: nodeEnvSchema.default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    CLIENT_ORIGIN: z.string().min(1).default("http://localhost:8081"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    DATABASE_MIGRATE_URL: z.string().min(1).optional(),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, "JWT_ACCESS_SECRET must be at least 32 characters")
      .refine((value) => !value.toLowerCase().includes("change-me"), "JWT_ACCESS_SECRET looks like a placeholder"),
    JWT_ACCESS_EXPIRES_IN: durationSchema.default("15m"),
    JWT_REFRESH_EXPIRES_IN: durationSchema.default("30d"),
    JWT_ISSUER: z.string().min(1).default("sayly-api"),
    JWT_AUDIENCE: z.string().min(1).default("sayly-client"),
    RESET_CODE_PEPPER: z.string().min(32, "RESET_CODE_PEPPER must be at least 32 characters"),
    ENABLE_SWAGGER: z.string().optional(),
    SWAGGER_PATH: z.string().min(1).default("/api-docs"),
    ENABLE_DEV_LOGS: z.string().optional(),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    LOGIN_IP_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    RESET_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
    RESET_IP_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    REFRESH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
    UPLOAD_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
    MESSAGE_SEND_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
    DISCOVERY_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
    REPORT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    MUTATION_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(40),
    PASSWORD_CHANGE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
    SOCKET_CONNECT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
    TYPING_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
    AI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    AI_USER_CONCURRENCY: z.coerce.number().int().positive().default(2),
    AI_GLOBAL_CONCURRENCY: z.coerce.number().int().positive().default(8),
    PRESENCE_LEASE_TTL_MS: z.coerce.number().int().positive().default(45_000),
    PRESENCE_HEARTBEAT_MS: z.coerce.number().int().positive().default(15_000),
    SESSION_RECHECK_MS: z.coerce.number().int().positive().default(30_000),
    PASSWORD_RESET_EXPIRES_IN: durationSchema.default("5m"),
    APP_RESET_URL: z.string().min(1).default("sayly://reset-password"),
    OPENAI_API_KEY: z.string().optional().default(""),
    /** Sent to Nominatim, whose usage policy requires an identifying User-Agent. */
    /** Comma-separated STUN servers handed to calling clients. */
    ICE_STUN_URLS: z.string().min(1).default("stun:stun.l.google.com:19302"),
    /** Comma-separated TURN URLs (e.g. turn:turn.example.com:3478). Without it, calls only connect when a direct path exists. */
    TURN_URLS: z.string().optional().default(""),
    /** coturn "use-auth-secret" shared secret; clients get short-lived credentials derived from it. */
    TURN_SHARED_SECRET: z.string().optional().default(""),
    TURN_CREDENTIAL_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
    GEOCODER_USER_AGENT: z.string().min(1).default("Sayly/1.0 (language exchange app)"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().optional(),
    DB_POOL_MAX: z.coerce.number().int().positive().default(10),
    REDIS_URL: z.string().min(1).optional(),
    REDIS_USERNAME: z.string().optional(),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_TLS: z.string().optional(),
    REDIS_KEY_PREFIX: z.string().min(1).default("sayly"),
    REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
    REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(2_000),
    REDIS_USE_MEMORY: z.string().optional(),
    UPLOADS_DIR: z.string().min(1).optional(),
    MEDIA_SIGNING_SECRET: z.string().min(32).optional(),
    MEDIA_USER_QUOTA_BYTES: z.coerce.number().int().positive().default(500 * 1024 * 1024),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && (!value.SMTP_HOST || !value.MAIL_FROM)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Production requires SMTP_HOST and MAIL_FROM for password recovery mail",
        path: ["SMTP_HOST"],
      });
    }
    if (value.NODE_ENV === "production" && !value.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Production requires REDIS_URL for shared rate limits, presence, sockets, and revocation",
        path: ["REDIS_URL"],
      });
    }
    if (value.NODE_ENV === "production" && !value.MEDIA_SIGNING_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Production requires MEDIA_SIGNING_SECRET (do not reuse JWT_ACCESS_SECRET)",
        path: ["MEDIA_SIGNING_SECRET"],
      });
    }
  });

const parsed = envSchema.parse(process.env);
const clientOrigins = parseOrigins(parsed.CLIENT_ORIGIN);
const nodeEnv = parsed.NODE_ENV;

function optionalBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") {
    return fallback;
  }
  return value === "true" || value === "1";
}

const useMemoryRedis = optionalBool(parsed.REDIS_USE_MEMORY, nodeEnv === "test");

export const env = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  isTest: nodeEnv === "test",
  /** Raw error details in 500 responses: only when NODE_ENV is explicitly development/test (the default must not leak SQL). */
  exposeErrorDetails: process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test",
  port: parsed.PORT,
  clientOrigin: clientOrigins[0] ?? "http://localhost:8081",
  clientOrigins,
  databaseUrl: parsed.DATABASE_URL,
  jwtAccessSecret: parsed.JWT_ACCESS_SECRET,
  jwtAccessExpiresIn: parsed.JWT_ACCESS_EXPIRES_IN,
  jwtRefreshExpiresIn: parsed.JWT_REFRESH_EXPIRES_IN,
  jwtIssuer: parsed.JWT_ISSUER,
  jwtAudience: parsed.JWT_AUDIENCE,
  resetCodePepper: parsed.RESET_CODE_PEPPER,
  enableSwagger: optionalBool(parsed.ENABLE_SWAGGER, nodeEnv !== "production"),
  swaggerPath: parsed.SWAGGER_PATH,
  enableDevLogs: optionalBool(parsed.ENABLE_DEV_LOGS, nodeEnv !== "production"),
  authRateLimitWindowMs: parsed.AUTH_RATE_LIMIT_WINDOW_MS,
  authRateLimitMax: parsed.AUTH_RATE_LIMIT_MAX,
  loginRateLimitMax: parsed.LOGIN_RATE_LIMIT_MAX,
  loginIpRateLimitMax: parsed.LOGIN_IP_RATE_LIMIT_MAX,
  resetRateLimitMax: parsed.RESET_RATE_LIMIT_MAX,
  resetIpRateLimitMax: parsed.RESET_IP_RATE_LIMIT_MAX,
  refreshRateLimitMax: parsed.REFRESH_RATE_LIMIT_MAX,
  uploadRateLimitMax: parsed.UPLOAD_RATE_LIMIT_MAX,
  messageSendRateLimitMax: parsed.MESSAGE_SEND_RATE_LIMIT_MAX,
  discoveryRateLimitMax: parsed.DISCOVERY_RATE_LIMIT_MAX,
  reportRateLimitMax: parsed.REPORT_RATE_LIMIT_MAX,
  mutationRateLimitMax: parsed.MUTATION_RATE_LIMIT_MAX,
  passwordChangeRateLimitMax: parsed.PASSWORD_CHANGE_RATE_LIMIT_MAX,
  socketConnectRateLimitMax: parsed.SOCKET_CONNECT_RATE_LIMIT_MAX,
  typingRateLimitMax: parsed.TYPING_RATE_LIMIT_MAX,
  aiRateLimitMax: parsed.AI_RATE_LIMIT_MAX,
  aiUserConcurrency: parsed.AI_USER_CONCURRENCY,
  aiGlobalConcurrency: parsed.AI_GLOBAL_CONCURRENCY,
  presenceLeaseTtlMs: parsed.PRESENCE_LEASE_TTL_MS,
  presenceHeartbeatMs: parsed.PRESENCE_HEARTBEAT_MS,
  sessionRecheckMs: parsed.SESSION_RECHECK_MS,
  passwordResetExpiresIn: parsed.PASSWORD_RESET_EXPIRES_IN,
  appResetUrl: parsed.APP_RESET_URL,
  openaiApiKey: parsed.OPENAI_API_KEY,
  geocoderUserAgent: parsed.GEOCODER_USER_AGENT,
  iceStunUrls: parsed.ICE_STUN_URLS.split(",").map((url) => url.trim()).filter(Boolean),
  turnUrls: parsed.TURN_URLS.split(",").map((url) => url.trim()).filter(Boolean),
  turnSharedSecret: parsed.TURN_SHARED_SECRET,
  turnCredentialTtlSeconds: parsed.TURN_CREDENTIAL_TTL_SECONDS,
  smtpHost: parsed.SMTP_HOST ?? "",
  smtpPort: parsed.SMTP_PORT ?? 587,
  smtpUser: parsed.SMTP_USER ?? "",
  smtpPass: parsed.SMTP_PASS ?? "",
  mailFrom: parsed.MAIL_FROM ?? "",
  dbPoolMax: parsed.DB_POOL_MAX,
  redisUrl: parsed.REDIS_URL ?? "redis://127.0.0.1:6379",
  redisUsername: parsed.REDIS_USERNAME ?? "",
  redisPassword: parsed.REDIS_PASSWORD ?? "",
  redisTls: optionalBool(parsed.REDIS_TLS, (parsed.REDIS_URL ?? "").startsWith("rediss://")),
  redisKeyPrefix: `${parsed.REDIS_KEY_PREFIX}:${nodeEnv}`,
  redisConnectTimeoutMs: parsed.REDIS_CONNECT_TIMEOUT_MS,
  redisCommandTimeoutMs: parsed.REDIS_COMMAND_TIMEOUT_MS,
  useMemoryRedis,
  uploadsDir: path.resolve(parsed.UPLOADS_DIR || path.join(process.cwd(), "uploads")),
  mediaSigningSecret: parsed.MEDIA_SIGNING_SECRET || parsed.JWT_ACCESS_SECRET,
  mediaUserQuotaBytes: parsed.MEDIA_USER_QUOTA_BYTES,
} as const;
