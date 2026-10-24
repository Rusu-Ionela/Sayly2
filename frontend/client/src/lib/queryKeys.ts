import type { DiscoveryFilters } from "@/features/discovery/types";
import type { GroupFilters } from "@/features/groups/types";

export const queryKeys = {
  profile: {
    all: ["profile"] as const,
    me: ["profile", "me"] as const,
    /** Prefix for invalidating every public-profile query. */
    publicAll: ["public-profile"] as const,
    public: (userId: string) => ["public-profile", userId] as const,
  },
  discovery: {
    all: ["discovery"] as const,
    list: (filters: DiscoveryFilters) => ["discovery", filters] as const,
  },
  follows: {
    all: ["follows"] as const,
  },
  notifications: {
    inbox: ["notifications", "inbox"] as const,
    unread: ["notifications", "unread"] as const,
  },
  references: {
    user: (userId: string) => ["references", userId] as const,
  },
  chat: {
    conversations: ["conversations"] as const,
    messages: (conversationId: string) => ["messages", conversationId] as const,
  },
  groups: {
    all: ["groups"] as const,
    list: (filters: GroupFilters) => ["groups", "list", filters] as const,
    detail: (groupId: string) => ["groups", "detail", groupId] as const,
    members: (groupId: string, status: string) => ["groups", "members", groupId, status] as const,
    messages: (groupId: string) => ["groups", "messages", groupId] as const,
  },
  languages: {
    catalog: ["languages"] as const,
    mine: ["userLanguages"] as const,
  },
  profileVisits: {
    all: ["profile-visits"] as const,
    list: (mode: "visitors" | "viewed") => ["profile-visits", mode] as const,
  },
  topics: {
    mine: ["topics"] as const,
  },
  collection: {
    phrases: ["learning", "phrases"] as const,
    expressions: ["learning", "expressions"] as const,
  },
  certificates: {
    offers: ["certificates", "offers"] as const,
  },
  safety: {
    blocks: ["safety", "blocks"] as const,
  },
  locations: {
    cities: (country: string, query: string) => ["locations", "cities", country, query] as const,
  },
} as const;
