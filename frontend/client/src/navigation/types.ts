import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native";

// Model files, not the support barrel: the barrel re-exports screens that import these types.
import type { GuidelinesKind } from "@/features/support/model/guidelines";
import type { SupportFormKind } from "@/features/support/model/supportForms";
import type { SupportTopic } from "@sayly/shared";

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetPassword: { challengeId: string; code?: string; expiresInSeconds?: number };
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
};

export type MainTabParamList = {
  Community: undefined;
  Chats: undefined;
  Groups: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  PublicProfile: { userId: string };
  /** @deprecated Use PublicProfile — same screen and params. */
  UserPreview: { userId: string };
  /** `draft` pre-fills the composer (e.g. replying to an icebreaker answer). */
  Conversation: { conversationId: string; draft?: string };
  /** Everyone's answers to today's icebreaker in one language. */
  IcebreakerAnswers: { languageId: string; languageName: string; question: string };
  EditProfile: undefined;
  GroupDetail: { groupId: string };
  GroupChat: { groupId: string };
  /** The group's feed: posts, reactions and comments. */
  GroupFeed: { groupId: string };
  GroupPost: { groupId: string; postId: string };
  /** Open live audio rooms; a group's rooms are listed on its screen. */
  PartyRooms: undefined;
  /** With `group`, the room belongs to that group and uses its language. */
  CreatePartyRoom:
    { group?: { id: string; name: string; languageId: string; languageLabel: string } } | undefined;
  PartyRoom: { roomId: string };
  CreateGroup: undefined;
  LanguagePreferences: undefined;
  /** Notifications, appearance, blocked members and account. */
  Settings: undefined;
  BlockedUsers: undefined;
  Collection: undefined;
  Certificates: { tab?: "get" | "mine" } | undefined;
  LearningPreferences: undefined;
  Topics: undefined;
  Following: undefined;
  /** Language-partner requests (consent-based; Follow stays one-way). */
  Connections: undefined;
  /** 3-minute timed challenge with a partner practising the same language. */
  FlashQuest: { languageId: string; languageName: string };
  /** You and your connections ranked by daily streak, with the weekly Pro prize. */
  FriendsLeaderboard: undefined;
  /** In-app inbox: corrections and references. */
  Notifications: undefined;
  ProfileVisits: { mode: "visitors" | "viewed" };
  /** Opened from a shared Sayly ID link; resolves to PublicProfile. */
  SharedProfile: { saylyId: string };
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  Imprint: undefined;
  AboutUs: undefined;
  /** Community guidelines or the Language Parties rules. */
  Guidelines: { kind: GuidelinesKind };
  Faq: undefined;
  /** Contact us, Request a feature or Report a bug. */
  SupportForm: { kind: SupportFormKind; topic?: SupportTopic };
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Onboarding: undefined;
  App: NavigatorScreenParams<AppStackParamList>;
};

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<AppStackParamList>
>;
