/** A conversation topic a member offers to talk about (free text, unlike profile interests). */
export type ConversationTopicDto = {
  id: string;
  title: string;
  /** Shown on the profile as "Main topic"; at most one per member. */
  isMain: boolean;
  createdAt: string;
};

export type ConversationTopicsDto = {
  items: ConversationTopicDto[];
  /** How many topics a member may have. */
  max: number;
};

export type CreateTopicInput = {
  title: string;
  isMain?: boolean;
};
