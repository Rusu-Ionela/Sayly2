import type { AuthenticatedUser } from "../../features/auth/types";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
      authVersion?: number;
      accessTokenExpiresAt?: number;
    }
  }
}

export {};
