import type { FlashQuestDto, RadarPartnerDto, RadarRing } from "@sayly/shared";

/** Ring radius as a share of the radar's radius: inner = best language fit. */
export const RING_FRACTIONS: Record<RadarRing, number> = { 0: 0.36, 1: 0.64, 2: 0.9 };

/** Small stable hash, so a member keeps their spot on the radar between refreshes. */
function hashToUnit(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export type RadarDot = { partner: RadarPartnerDto; x: number; y: number };

/**
 * Places partners on their ring, evenly spread with a stable per-member offset, as x/y
 * offsets from the radar's center (pixels).
 */
export function layoutRadar(partners: RadarPartnerDto[], radius: number): RadarDot[] {
  const byRing = new Map<RadarRing, RadarPartnerDto[]>();
  for (const partner of partners) {
    byRing.set(partner.ring, [...(byRing.get(partner.ring) ?? []), partner]);
  }
  const dots: RadarDot[] = [];
  for (const [ring, members] of byRing) {
    const ringRadius = radius * RING_FRACTIONS[ring];
    const step = (2 * Math.PI) / members.length;
    const firstId = members[0]?.id ?? "";
    const start = hashToUnit(`${ring}:${firstId}`) * 2 * Math.PI;
    members.forEach((partner, index) => {
      const jitter = (hashToUnit(partner.id) - 0.5) * step * 0.4;
      const angle = start + index * step + jitter;
      dots.push({ partner, x: Math.cos(angle) * ringRadius, y: Math.sin(angle) * ringRadius });
    });
  }
  return dots;
}

/** "now" for an ONLINE partner, otherwise "5 min ago". */
export function lastActiveLabel(partner: RadarPartnerDto, now: number = Date.now()): string {
  if (partner.availability === "ONLINE") return "Online now";
  const minutes = Math.max(1, Math.round((now - Date.parse(partner.lastActiveAt)) / 60_000));
  return `Active ${minutes} min ago`;
}

/** Difference between the server clock and this phone, from one quest response. */
export function clockOffsetMs(quest: Pick<FlashQuestDto, "serverNow">, receivedAt: number): number {
  return Date.parse(quest.serverNow) - receivedAt;
}

/** Milliseconds left on the quest timer, by the server's clock. */
export function questRemainingMs(
  quest: Pick<FlashQuestDto, "endsAt">,
  offsetMs: number,
  now: number = Date.now(),
): number {
  if (!quest.endsAt) return 0;
  return Math.max(0, Date.parse(quest.endsAt) - (now + offsetMs));
}

/** 2:05, 0:09 */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** "23h left", "45m left" for a spark's expiry. */
export function expiresInLabel(expiresAt: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 60_000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h left` : `${minutes}m left`;
}
