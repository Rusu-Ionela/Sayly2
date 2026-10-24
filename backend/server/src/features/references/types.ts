/** Ratings at or above this count as a positive reference. */
export const POSITIVE_RATING = 4;
export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const REFERENCE_BODY_MAX = 500;
export const REFERENCES_PAGE_SIZE = 20;

/** Shown on every profile so anyone can see whether partners vouch for this member. */
export type ReferenceSummaryDto = {
  total: number;
  positive: number;
};

export type ReferenceAuthorDto = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type ReferenceDto = {
  id: string;
  /** 1–5. */
  rating: number;
  body: string;
  createdAt: string;
  author: ReferenceAuthorDto;
};

/** The viewer's own reference about someone (no author block: it's you). */
export type MyReferenceDto = Omit<ReferenceDto, "author">;

export type ReferencesPageDto = {
  summary: ReferenceSummaryDto;
  items: ReferenceDto[];
  page: number;
  hasMore: boolean;
  /** True when the viewer may write (or already wrote) a reference for this member. */
  canWrite: boolean;
  mine: MyReferenceDto | null;
};

/** Body of POST /users/:userId/references. The author comes from the session. */
export type SaveReferenceInput = {
  rating: number;
  body: string;
};
