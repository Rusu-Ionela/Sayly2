import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";

import { configureApiAuth, ensureAccessToken } from "@/lib/apiClient";
import { isApiError } from "@/lib/api/errors";
import { log, maskEmail } from "@/lib/logger";
import { queryClient } from "@/lib/queryClient";
import { configureSocketAuth, resetSocket } from "@/lib/socket";

import { runSignOutTasks } from "./signOutTasks";
import * as authApi from "./api/authApi";
import { authStorage } from "./authStorage";
import type { AuthSession, AuthUser, LoginInput, RegisterInput } from "./types";

type AuthContextValue = {
  user: AuthUser | null;
  userId: string | null;
  isSignedIn: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  isSigningIn: boolean;
  isSigningOut: boolean;
  signIn: (input: LoginInput) => Promise<AuthUser>;
  signUp: (input: RegisterInput) => Promise<AuthUser>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const accessTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    refreshTokenRef.current = refreshToken;
  }, [refreshToken]);

  const persistSession = useCallback(async (session: AuthSession) => {
    await authStorage.setTokens({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    await authStorage.setUser(session.user);
    accessTokenRef.current = session.accessToken;
    refreshTokenRef.current = session.refreshToken;
    setAccessToken(session.accessToken);
    setRefreshToken(session.refreshToken);
    setUser(session.user);
  }, []);

  const clearSessionPromise = useRef<Promise<void> | null>(null);

  const clearSession = useCallback(async () => {
    if (clearSessionPromise.current) {
      return clearSessionPromise.current;
    }
    clearSessionPromise.current = (async () => {
      resetSocket();
      await queryClient.cancelQueries();
      await authStorage.clear();
      accessTokenRef.current = null;
      refreshTokenRef.current = null;
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
      queryClient.clear();
    })().finally(() => {
      clearSessionPromise.current = null;
    });
    return clearSessionPromise.current;
  }, []);

  useEffect(() => {
    configureApiAuth({
      getAccessToken: () => accessTokenRef.current,
      getRefreshToken: () => refreshTokenRef.current,
      onTokensRefreshed: async (tokens, refreshedUser) => {
        log.info("auth", "tokens refreshed");
        await authStorage.setTokens(tokens);
        accessTokenRef.current = tokens.accessToken;
        refreshTokenRef.current = tokens.refreshToken;
        setAccessToken(tokens.accessToken);
        setRefreshToken(tokens.refreshToken);
        if (refreshedUser) {
          setUser(refreshedUser);
          await authStorage.setUser(refreshedUser);
        }
      },
      onAuthFailure: async () => {
        log.warn("auth", "session cleared after auth failure");
        await clearSession();
      },
    });
    configureSocketAuth(() => accessTokenRef.current);
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      log.debug("auth", "bootstrap started");
      try {
        const tokens = await authStorage.getTokens();
        const cached = await authStorage.getUser();

        if (tokens?.refreshToken) {
          log.debug("auth", "bootstrap — restoring session from storage");
          refreshTokenRef.current = tokens.refreshToken;
          setRefreshToken(tokens.refreshToken);

          if (tokens.accessToken) {
            accessTokenRef.current = tokens.accessToken;
            setAccessToken(tokens.accessToken);
          } else {
            const refreshed = await ensureAccessToken();
            if (!refreshed) {
              log.warn("auth", "bootstrap — could not refresh access token");
              await clearSession();
              return;
            }
          }
        } else if (Platform.OS === "web") {
          // Web: HttpOnly cookie may still be valid.
          log.debug("auth", "bootstrap — trying cookie session refresh");
          const refreshed = await ensureAccessToken();
          if (!refreshed) {
            log.debug("auth", "bootstrap — no web cookie session");
            return;
          }
        } else {
          log.debug("auth", "bootstrap — no stored tokens");
          return;
        }

        const cachedUser = cached ?? (await authStorage.getUser());
        if (cachedUser && !cancelled) {
          setUser(cachedUser);
        }

        // Prefer cached AuthUser on cold start; RootNavigator loads full /users/me once.
        if (!cachedUser) {
          const me = await authApi.getMe();
          if (!cancelled) {
            log.info("auth", "bootstrap succeeded", { userId: me.user.id });
            setUser(me.user);
            await authStorage.setUser(me.user);
          }
        } else if (!cancelled) {
          log.info("auth", "bootstrap succeeded from cache", { userId: cachedUser.id });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        // Keep tokens on transient network failure; restore cached user if available.
        // Tokens stay in memory so RootNavigator can show a retry gate (not Auth).
        if (isApiError(error) && error.isNetwork) {
          log.warn("auth", "bootstrap network error — using cached user if available", {
            code: error.code,
          });
          const cached = await authStorage.getUser();
          if (cached) {
            setUser(cached);
          }
        } else {
          log.warn("auth", "bootstrap failed — clearing session", {
            code: isApiError(error) ? error.code : "unknown",
            message: error instanceof Error ? error.message : "unknown",
          });
          await clearSession();
        }
      } finally {
        if (!cancelled) {
          log.debug("auth", "bootstrap finished");
          setIsInitialized(true);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const signIn = useCallback(
    async (input: LoginInput) => {
      setIsSigningIn(true);
      log.info("auth", "sign in started", { email: maskEmail(input.email.trim().toLowerCase()) });
      try {
        const session = await authApi.login({
          email: input.email.trim().toLowerCase(),
          password: input.password,
        });
        await persistSession(session);
        log.info("auth", "sign in succeeded", { userId: session.user.id });
        return session.user;
      } catch (error) {
        log.warn("auth", "sign in failed", {
          email: maskEmail(input.email.trim().toLowerCase()),
          code: isApiError(error) ? error.code : "unknown",
          message: error instanceof Error ? error.message : "unknown",
        });
        throw error;
      } finally {
        setIsSigningIn(false);
      }
    },
    [persistSession],
  );

  const signUp = useCallback(
    async (input: RegisterInput) => {
      setIsSigningIn(true);
      log.info("auth", "sign up started", { email: maskEmail(input.email.trim().toLowerCase()) });
      try {
        const session = await authApi.register({
          email: input.email.trim().toLowerCase(),
          password: input.password,
          displayName: input.displayName.trim(),
        });
        await persistSession(session);
        log.info("auth", "sign up succeeded", { userId: session.user.id });
        return session.user;
      } catch (error) {
        log.warn("auth", "sign up failed", {
          email: maskEmail(input.email.trim().toLowerCase()),
          code: isApiError(error) ? error.code : "unknown",
          message: error instanceof Error ? error.message : "unknown",
        });
        throw error;
      } finally {
        setIsSigningIn(false);
      }
    },
    [persistSession],
  );

  const signOut = useCallback(async () => {
    setIsSigningOut(true);
    log.info("auth", "sign out started");
    try {
      await runSignOutTasks();
      const token = refreshTokenRef.current;
      if (token) {
        try {
          await authApi.logout(token);
        } catch (error) {
          log.warn("auth", "logout request failed — clearing local session anyway", {
            message: error instanceof Error ? error.message : "unknown",
          });
        }
      }
      await clearSession();
      log.info("auth", "sign out completed");
    } finally {
      setIsSigningOut(false);
    }
  }, [clearSession]);

  const isLoading = isSigningIn || isSigningOut;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      userId: user?.id ?? null,
      // Refresh token is the durable session; access may be mid-refresh.
      isSignedIn: Boolean(refreshToken),
      isInitialized,
      isLoading,
      isSigningIn,
      isSigningOut,
      signIn,
      signUp,
      signOut,
    }),
    [
      user,
      refreshToken,
      isInitialized,
      isLoading,
      isSigningIn,
      isSigningOut,
      signIn,
      signUp,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return value;
}
