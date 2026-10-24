import { apiClient } from "@/lib/apiClient";

import type { AuthSession, LoginInput, MeResponse, RegisterInput } from "../types";

export function login(input: LoginInput) {
  return apiClient.post<AuthSession>("/auth/login", input, { skipAuth: true });
}

export function register(input: RegisterInput) {
  return apiClient.post<AuthSession>("/auth/register", input, { skipAuth: true });
}

export function logout(refreshToken: string) {
  return apiClient.post<{ ok: true }>("/auth/logout", { refreshToken }, { skipAuth: true });
}

export function getMe() {
  return apiClient.get<MeResponse>("/auth/me");
}

export type ForgotPasswordResponse = {
  ok: true;
  expiresInSeconds?: number;
  challengeId: string;
};

export function requestPasswordReset(email: string) {
  return apiClient.post<ForgotPasswordResponse>(
    "/auth/forgot-password",
    { email },
    { skipAuth: true },
  );
}

export function resetPassword(input: { challengeId: string; token: string; password: string }) {
  return apiClient.post<{ ok: true }>("/auth/reset-password", input, { skipAuth: true });
}
