export type PageParams = {
  limit: number;
  offset: number;
};

export function parsePage(query: { limit?: string; offset?: string }): PageParams {
  const limit = Math.min(Number(query.limit ?? 20), 50);
  const offset = Math.max(Number(query.offset ?? 0), 0);

  return { limit, offset };
}
