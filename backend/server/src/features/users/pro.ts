/**
 * Pro access = a paid/admin Pro (`isPro`) or a temporary grant that has not run out yet
 * (`proUntil`, e.g. the weekly friends-leaderboard reward). Every Pro check goes through here.
 */
export function hasProAccess(
  user: { isPro: boolean; proUntil: Date | null },
  now: Date = new Date(),
): boolean {
  return user.isPro || (user.proUntil !== null && user.proUntil > now);
}
