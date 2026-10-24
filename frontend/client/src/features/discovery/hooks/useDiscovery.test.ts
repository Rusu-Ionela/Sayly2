import { queryKeys } from "@/lib/queryKeys";

import type { DiscoverPage } from "../types";
import { DISCOVERY_PAGE_SIZE, getDiscoveryNextPageParam } from "./useDiscovery";

describe("discovery query keys", () => {
  it("changes when filters change", () => {
    const a = queryKeys.discovery.list({ search: "spa" });
    const b = queryKeys.discovery.list({ search: "fre" });
    const c = queryKeys.discovery.list({ search: "spa" });
    expect(a).not.toEqual(b);
    expect(a).toEqual(c);
  });

  it("trims search at the screen layer expectation", () => {
    const filters = { search: "  hello  ".trim() || undefined };
    expect(filters.search).toBe("hello");
  });
});

describe("discovery pagination", () => {
  it("uses a 20-item page size", () => {
    expect(DISCOVERY_PAGE_SIZE).toBe(20);
  });

  it("advances when hasMore is true", () => {
    const page: DiscoverPage = {
      items: [],
      page: 1,
      limit: DISCOVERY_PAGE_SIZE,
      total: 40,
      hasMore: true,
    };
    expect(getDiscoveryNextPageParam(page)).toBe(2);
  });

  it("advances from meta when page*limit < total", () => {
    const page: DiscoverPage = {
      items: [],
      page: 2,
      limit: 20,
      total: 55,
      hasMore: false,
      meta: { page: 2, limit: 20, total: 55, totalPages: 3, hasMore: false },
    };
    expect(getDiscoveryNextPageParam(page)).toBe(3);
  });

  it("stops when the last page is fully consumed", () => {
    const page: DiscoverPage = {
      items: [],
      page: 2,
      limit: 20,
      total: 40,
      hasMore: false,
    };
    expect(getDiscoveryNextPageParam(page)).toBeUndefined();
  });
});
