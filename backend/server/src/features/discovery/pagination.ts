import type { DiscoverResult, DiscoverUser } from "./types";

export function toDiscoverPage(
  items: DiscoverUser[],
  page: number,
  limit: number,
  total: number,
): DiscoverResult {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const hasMore = page * limit < total;
  const meta = { page, limit, total, totalPages, hasMore };

  return {
    items,
    meta,
    page,
    limit,
    totalCount: total,
    totalPages,
    total,
    hasMore,
  };
}
