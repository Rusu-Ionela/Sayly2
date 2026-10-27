import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";

import { ApiError } from "./api/errors";
import { log } from "./logger";

const API_PORT = 4000;

function isLoopback(host: string | null | undefined): boolean {
  return !host || host === "localhost" || host === "127.0.0.1";
}

/** Metro / Expo Go host (same LAN machine as the API in local dev). */
function metroHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } }).manifest2
      ?.extra?.expoClient?.hostUri ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;

  if (hostUri) {
    const host = hostUri.split(":")[0]?.trim();
    if (host && !isLoopback(host)) return host;
  }

  const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
  const fromScript = scriptURL?.match(/https?:\/\/([^:/]+)/)?.[1];
  if (!isLoopback(fromScript)) return fromScript ?? null;

  return null;
}

function resolveApiBaseUrl(): string {
  // Explicit .env wins everywhere except local web dev (see below). Restart Expo with -c after changes.
  const override = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  const isRelease = typeof __DEV__ !== "undefined" && !__DEV__;

  // Local web dev: reuse the page host. A LAN-IP override (meant for phones) would make the
  // API cross-site from http://localhost:8081, so the SameSite=Lax refresh cookie is dropped.
  if (Platform.OS === "web" && !isRelease && (!override || override.startsWith("http://"))) {
    const pageHost = typeof window !== "undefined" ? window.location?.hostname : undefined;
    return `http://${pageHost || "localhost"}:${API_PORT}`;
  }

  if (override) {
    return override;
  }

  if (isRelease) {
    throw new Error("EXPO_PUBLIC_API_URL must be set to an https:// API URL in release builds.");
  }

  // Expo Go: same host that served the JS bundle (LAN IP), never phone localhost.
  const host = metroHost();
  if (host) {
    return `http://${host}:${API_PORT}`;
  }

  if (Platform.OS === "android") {
    return `http://10.0.2.2:${API_PORT}`;
  }

  return `http://localhost:${API_PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

const fetchCredentials: RequestCredentials = Platform.OS === "web" ? "include" : "same-origin";

type Json = Record<string, unknown> | unknown[] | null;

type AuthHandlers = {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onTokensRefreshed: (
    tokens: {
      accessToken: string;
      refreshToken: string;
    },
    user?: import("@/features/auth/types").AuthUser,
  ) => Promise<void> | void;
  onAuthFailure: () => Promise<void> | void;
};

type RequestOptions = RequestInit & {
  /** Skip Authorization header (login/register/refresh/logout). */
  skipAuth?: boolean;
  /** Internal: already retried after refresh. */
  _retried?: boolean;
  /** Multipart body — never set JSON Content-Type. */
  form?: boolean;
};

const AUTH_SKIP_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
  "/auth/forgot-password",
  "/auth/reset-password",
]);

let authHandlers: AuthHandlers = {
  getAccessToken: () => null,
  getRefreshToken: () => null,
  onTokensRefreshed: () => undefined,
  onAuthFailure: () => undefined,
};

let refreshPromise: Promise<boolean> | null = null;

export function configureApiAuth(handlers: AuthHandlers) {
  authHandlers = handlers;
}

function shouldAttachAuth(path: string, skipAuth?: boolean): boolean {
  if (skipAuth) {
    return false;
  }
  return !AUTH_SKIP_PATHS.has(path);
}

const DEFAULT_TIMEOUT_MS = 15_000;

function mergeSignal(userSignal: AbortSignal | null | undefined, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  if (userSignal) {
    userSignal.addEventListener("abort", onAbort);
  }

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      if (userSignal) {
        userSignal.removeEventListener("abort", onAbort);
      }
    },
  };
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) {
    log.debug("api", "token refresh already in progress");
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = authHandlers.getRefreshToken();
    // Native requires an in-memory/persisted refresh token.
    // Web may refresh via HttpOnly cookie with an empty body.
    if (!refreshToken && Platform.OS !== "web") {
      log.warn("api", "token refresh skipped — no refresh token");
      return false;
    }

    log.info("api", "refreshing access token");

    const { signal, dispose } = mergeSignal(undefined);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
        credentials: fetchCredentials,
        signal,
      });

      if (!response.ok) {
        log.warn("api", "token refresh failed", { status: response.status });
        return false;
      }

      const data: unknown = await response.json();
      if (!isUsableTokenPair(data)) {
        log.warn("api", "token refresh returned invalid body");
        return false;
      }

      await authHandlers.onTokensRefreshed(
        {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        },
        isAuthUser(data.user) ? data.user : undefined,
      );
      log.info("api", "token refresh succeeded");
      return true;
    } catch (error) {
      log.error("api", "token refresh network error", {
        message: error instanceof Error ? error.message : "unknown",
      });
      return false;
    } finally {
      dispose();
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/** Ensure an access token is available (refresh when memory-only / expired). */
export async function ensureAccessToken(): Promise<boolean> {
  if (authHandlers.getAccessToken()) {
    return true;
  }
  return refreshAccessToken();
}

/** Refresh a little before expiry so a socket handshake never carries a dying token. */
const TOKEN_REFRESH_MARGIN_MS = 60_000;

/**
 * `exp` of a JWT in milliseconds, or null when it cannot be read.
 * Used by the socket to time its reauth (and by freshToken.test).
 */
export function jwtExpiresAtMs(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const claims = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof claims.exp === "number" ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * An access token valid for at least another minute — refreshed first when it is missing
 * or about to expire. Used by the realtime socket, which cannot retry on a 401 like HTTP.
 */
export async function getFreshAccessToken(now = Date.now()): Promise<string | null> {
  const current = authHandlers.getAccessToken();
  const expiresAt = current ? jwtExpiresAtMs(current) : null;
  if (current && (expiresAt === null || expiresAt - now > TOKEN_REFRESH_MARGIN_MS)) {
    return current;
  }
  const refreshed = await refreshAccessToken();
  return refreshed ? authHandlers.getAccessToken() : null;
}

function isUsableTokenPair(data: unknown): data is {
  accessToken: string;
  refreshToken: string;
  user?: unknown;
} {
  if (!data || typeof data !== "object") {
    return false;
  }
  const record = data as { accessToken?: unknown; refreshToken?: unknown };
  return (
    typeof record.accessToken === "string" &&
    record.accessToken.length > 0 &&
    typeof record.refreshToken === "string" &&
    record.refreshToken.length > 0
  );
}

function isAuthUser(value: unknown): value is import("@/features/auth/types").AuthUser {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as { id?: unknown; email?: unknown };
  return typeof record.id === "string" && typeof record.email === "string";
}

function parseXhrError(xhr: XMLHttpRequest) {
  try {
    const body = JSON.parse(xhr.responseText) as {
      error?: { code?: string; message?: string; fields?: Record<string, string> };
    };
    return new ApiError({
      status: xhr.status,
      code: body.error?.code ?? (xhr.status === 400 ? "VALIDATION_ERROR" : "REQUEST_FAILED"),
      message: body.error?.message ?? "Upload failed",
      fields: body.error?.fields,
    });
  } catch {
    return new ApiError({
      status: xhr.status,
      code: "REQUEST_FAILED",
      message: "Upload failed",
    });
  }
}

async function postFormRequest<T>(
  path: string,
  body: FormData,
  options: { skipAuth?: boolean; _retried?: boolean },
): Promise<T> {
  const started = Date.now();
  const token = shouldAttachAuth(path, options.skipAuth) ? authHandlers.getAccessToken() : null;

  log.debug("api", "request", {
    method: "POST",
    path,
    baseUrl: API_BASE_URL,
    hasAuth: Boolean(token),
    form: true,
    retried: Boolean(options._retried),
  });

  if (Platform.OS === "web") {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers,
        body,
        credentials: fetchCredentials,
      });
    } catch (error) {
      log.warn("api", "network error", {
        method: "POST",
        path,
        message: error instanceof Error ? error.message : "unknown",
      });
      throw new ApiError({
        status: 0,
        code: "NETWORK_ERROR",
        message: "Unable to connect. Please check your internet connection and try again.",
      });
    }
    log.info("api", "response", {
      method: "POST",
      path,
      status: response.status,
      durationMs: Date.now() - started,
    });
    if (response.status === 401 && shouldAttachAuth(path, options.skipAuth) && !options._retried) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // A 401 means auth rejected the request before any handler ran, so replaying is safe.
        return postFormRequest<T>(path, body, { ...options, _retried: true });
      }
      await authHandlers.onAuthFailure();
    }
    if (!response.ok) throw await ApiError.fromResponse(response);
    return response.json() as Promise<T>;
  }

  try {
    return await new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE_URL}${path}`);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.onload = () => {
        log.info("api", "response", {
          method: "POST",
          path,
          status: xhr.status,
          durationMs: Date.now() - started,
        });
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as T);
          } catch {
            reject(
              new ApiError({
                status: xhr.status,
                code: "INTERNAL_ERROR",
                message: "Invalid upload response",
              }),
            );
          }
          return;
        }
        reject(parseXhrError(xhr));
      };
      xhr.onerror = () => {
        reject(
          new ApiError({
            status: 0,
            code: "NETWORK_ERROR",
            message: "Unable to connect. Please check your internet connection and try again.",
          }),
        );
      };
      xhr.send(body);
    });
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      shouldAttachAuth(path, options.skipAuth) &&
      !options._retried
    ) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return postFormRequest<T>(path, body, { ...options, _retried: true });
      }
      await authHandlers.onAuthFailure();
    }
    throw error;
  }
}

async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const { skipAuth, _retried, form, headers: initHeaders, ...rest } = init;
  const method = rest.method ?? "GET";
  const started = Date.now();

  if (form) {
    return postFormRequest<T>(path, rest.body as FormData, { skipAuth, _retried });
  }

  const headers: Record<string, string> = {};
  if (initHeaders) {
    new Headers(initHeaders).forEach((value, key) => {
      headers[key] = value;
    });
  }
  if (!headers["Content-Type"] && rest.body) {
    headers["Content-Type"] = "application/json";
  }

  if (shouldAttachAuth(path, skipAuth)) {
    const accessToken = authHandlers.getAccessToken();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  log.debug("api", "request", {
    method,
    path,
    baseUrl: API_BASE_URL,
    hasAuth: Boolean(headers.Authorization),
    retried: Boolean(_retried),
  });

  let response: Response;
  const { signal, dispose } = mergeSignal(rest.signal ?? undefined);
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers,
      credentials: fetchCredentials,
      signal,
    });
  } catch (error) {
    // Android reports an aborted fetch as a plain network error ("Fetch request has been
    // canceled"), so trust the signal rather than the error's name.
    const aborted =
      signal.aborted ||
      (error instanceof Error && error.name === "AbortError") ||
      (typeof DOMException !== "undefined" &&
        error instanceof DOMException &&
        error.name === "AbortError");
    const cancelledByCaller = Boolean(rest.signal?.aborted);
    const details = {
      method,
      path,
      baseUrl: API_BASE_URL,
      durationMs: Date.now() - started,
      aborted,
      message: error instanceof Error ? error.message : "unknown",
    };
    if (cancelledByCaller) {
      // e.g. the screen that asked for it closed — expected, not a network problem.
      log.debug("api", "request cancelled", details);
    } else {
      log.warn("api", "network error", details);
    }
    throw new ApiError({
      status: 0,
      code: "NETWORK_ERROR",
      message: cancelledByCaller
        ? "Request cancelled."
        : aborted
          ? "Request timed out. Please try again."
          : "Unable to connect. Please check your internet connection and try again.",
    });
  } finally {
    dispose();
  }

  log.info("api", "response", {
    method,
    path,
    status: response.status,
    durationMs: Date.now() - started,
  });

  if (response.status === 401 && shouldAttachAuth(path, skipAuth) && !_retried) {
    log.info("api", "401 received — attempting token refresh", { path });
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // A 401 means auth rejected the request before any handler ran, so replaying is safe.
      return request<T>(path, { ...init, _retried: true });
    }
    log.warn("api", "auth failure — clearing session", { path });
    await authHandlers.onAuthFailure();
    throw await ApiError.fromResponse(response);
  }

  if (!response.ok) {
    const apiError = await ApiError.fromResponse(response);
    log.warn("api", "request failed", {
      method,
      path,
      status: response.status,
      code: apiError.code,
      message: apiError.message,
    });
    throw apiError;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string, init?: RequestOptions) => request<T>(path, { ...init, method: "GET" }),
  post: <T>(path: string, body?: Json, init?: RequestOptions) =>
    request<T>(path, {
      ...init,
      method: "POST",
      body: body == null ? undefined : JSON.stringify(body),
    }),
  postForm: <T>(path: string, body: FormData, init?: RequestOptions) =>
    request<T>(path, {
      ...init,
      method: "POST",
      form: true,
      body,
    }),
  put: <T>(path: string, body?: Json, init?: RequestOptions) =>
    request<T>(path, {
      ...init,
      method: "PUT",
      body: body == null ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: Json, init?: RequestOptions) =>
    request<T>(path, {
      ...init,
      method: "PATCH",
      body: body == null ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string, init?: RequestOptions) =>
    request<T>(path, { ...init, method: "DELETE" }),
};
