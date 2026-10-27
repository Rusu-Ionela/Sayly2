import type { LinkingOptions } from "@react-navigation/native";

import type { RootStackParamList } from "./types";

/**
 * Shared profiles open from https://sayly.app/u/<SAYLY ID>.
 * Password-reset emails can deep-link:
 *   sayly://reset-password?challengeId=…&code=123456
 *   https://sayly.app/reset-password?challengeId=…&code=123456
 */
export const rootLinking: LinkingOptions<RootStackParamList> = {
  prefixes: ["sayly://", "https://sayly.app", "https://www.sayly.app"],
  config: {
    screens: {
      Auth: {
        screens: {
          Welcome: "welcome",
          Login: "login",
          SignUp: "signup",
          ForgotPassword: "forgot-password",
          ResetPassword: {
            path: "reset-password",
            parse: {
              challengeId: (value: string) => value,
              code: (value: string) => value,
              expiresInSeconds: (value: string) => {
                const n = Number(value);
                return Number.isFinite(n) ? n : undefined;
              },
            },
          },
        },
      },
      Onboarding: "onboarding",
      App: {
        screens: {
          MainTabs: {
            screens: {
              Community: "community",
              Chats: "chats",
              Groups: "groups",
              Profile: "profile",
            },
          },
          Conversation: "conversation/:conversationId",
          PublicProfile: "users/:userId",
          SharedProfile: "u/:saylyId",
          EditProfile: "edit-profile",
          GroupDetail: "groups/:groupId",
          GroupChat: "groups/:groupId/discussion",
          GroupFeed: "groups/:groupId/feed",
          GroupPost: "groups/:groupId/posts/:postId",
          PartyRooms: "rooms",
          PartyRoom: "rooms/:roomId",
          CreateGroup: "groups/new",
          LanguagePreferences: "languages",
          Settings: "settings",
          BlockedUsers: "blocked-users",
          Collection: "collection",
          Certificates: "certificates",
          LearningPreferences: "learning-preferences",
          Topics: "topics",
          Following: "following",
          Connections: "connections",
          FriendsLeaderboard: "leaderboard",
          Notifications: "notifications",
          ProfileVisits: "profile/:mode",
          Guidelines: "help/guidelines/:kind",
          Faq: "help/faq",
          SupportForm: "support/:kind",
        },
      },
    },
  },
};
