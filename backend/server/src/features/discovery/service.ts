import * as usersService from "../users/service";

import { toDiscoverPage } from "./pagination";
import * as discoveryRepository from "./repository";
import type { DiscoverFilters, DiscoverResult } from "./types";

export async function discover(viewerId: string, filters: DiscoverFilters): Promise<DiscoverResult> {
  const { items, totalCount } = await discoveryRepository.discoverPartners(viewerId, filters);
  return toDiscoverPage(items, filters.page, filters.limit, totalCount);
}

/** DISC-006 — same safe public profile as GET /users/:id/public-profile. */
export async function getDiscoverUser(viewerId: string, userId: string) {
  return usersService.getPublicProfile(viewerId, userId);
}
