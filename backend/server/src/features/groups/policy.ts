import type { GroupMemberStatus, GroupRole, GroupVisibility } from "../../db/schema";
import { AppError } from "../../shared/errors/AppError";

/**
 * Group business rules, kept free of I/O so they are unit-testable and shared
 * by every route. The repository calls these while holding the group row lock.
 */

export const MAX_OWNED_GROUPS = 10;
export const MAX_GROUP_MEMBERSHIPS = 50;
export const DEFAULT_MAX_MEMBERS = 200;

export type Membership = { role: GroupRole; status: GroupMemberStatus } | null;

type GroupState = {
  visibility: GroupVisibility;
  memberCount: number;
  maxMembers: number;
};

export function isActiveMember(membership: Membership): boolean {
  return membership?.status === "ACTIVE";
}

export function isModerator(membership: Membership): boolean {
  return isActiveMember(membership) && (membership!.role === "OWNER" || membership!.role === "MODERATOR");
}

export function isOwner(membership: Membership): boolean {
  return isActiveMember(membership) && membership!.role === "OWNER";
}

/** Messages and the member list are members-only for every visibility. */
export function assertCanReadContent(membership: Membership) {
  if (!isActiveMember(membership)) {
    throw new AppError("Join this group to see its discussion", 403, "FORBIDDEN");
  }
}

export function assertCanModerate(membership: Membership) {
  if (!isModerator(membership)) {
    throw new AppError("Only group owners and moderators can do this", 403, "FORBIDDEN");
  }
}

export function assertOwner(membership: Membership) {
  if (!isOwner(membership)) {
    throw new AppError("Only the group owner can do this", 403, "FORBIDDEN");
  }
}

/** Public groups admit immediately; private groups queue a request for moderators. */
export function joinOutcome(group: GroupState, membership: Membership): GroupMemberStatus {
  if (membership?.status === "ACTIVE") {
    throw new AppError("You are already a member of this group", 409, "CONFLICT");
  }
  if (membership?.status === "PENDING") {
    throw new AppError("Your request to join is already pending", 409, "CONFLICT");
  }
  if (group.visibility === "PRIVATE") {
    return "PENDING";
  }
  assertHasCapacity(group);
  return "ACTIVE";
}

export function assertHasCapacity(group: Pick<GroupState, "memberCount" | "maxMembers">) {
  if (group.memberCount >= group.maxMembers) {
    throw new AppError("This group is full", 409, "CONFLICT");
  }
}

export function assertCanLeave(membership: Membership) {
  if (!membership) {
    throw new AppError("You are not a member of this group", 404, "NOT_FOUND");
  }
  if (membership.status === "ACTIVE" && membership.role === "OWNER") {
    throw new AppError(
      "Transfer ownership or delete the group before leaving",
      409,
      "CONFLICT",
    );
  }
}

/**
 * Moderators may remove members (or reject requests); only the owner may
 * remove a moderator; nobody removes the owner or themselves this way.
 */
export function assertCanRemove(actorId: string, actor: Membership, targetId: string, target: Membership) {
  assertCanModerate(actor);
  if (!target) {
    throw new AppError("Member not found", 404, "NOT_FOUND");
  }
  if (actorId === targetId) {
    throw new AppError("Use leave to exit a group", 400, "VALIDATION_ERROR");
  }
  if (target.role === "OWNER") {
    throw new AppError("The owner cannot be removed", 403, "FORBIDDEN");
  }
  if (target.role === "MODERATOR" && !isOwner(actor)) {
    throw new AppError("Only the owner can remove a moderator", 403, "FORBIDDEN");
  }
}

export function assertCanApprove(actor: Membership, target: Membership) {
  assertCanModerate(actor);
  if (target?.status !== "PENDING") {
    throw new AppError("No pending request for this user", 404, "NOT_FOUND");
  }
}

export function assertCanChangeRole(actor: Membership, target: Membership, role: GroupRole) {
  assertOwner(actor);
  if (role === "OWNER") {
    throw new AppError("Use ownership transfer to change the owner", 400, "VALIDATION_ERROR");
  }
  if (!isActiveMember(target)) {
    throw new AppError("Member not found", 404, "NOT_FOUND");
  }
  if (target!.role === "OWNER") {
    throw new AppError("The owner's role cannot be changed", 403, "FORBIDDEN");
  }
}

export function assertCanTransfer(actorId: string, actor: Membership, targetId: string, target: Membership) {
  assertOwner(actor);
  if (actorId === targetId) {
    throw new AppError("You already own this group", 400, "VALIDATION_ERROR");
  }
  if (!isActiveMember(target)) {
    throw new AppError("New owner must be an active member", 400, "VALIDATION_ERROR");
  }
}

/** Visibility and capacity are owner-only; other content fields are moderator-editable. */
export function assertCanEdit(
  actor: Membership,
  patch: { visibility?: unknown; maxMembers?: number },
  memberCount: number,
) {
  assertCanModerate(actor);
  if ((patch.visibility !== undefined || patch.maxMembers !== undefined) && !isOwner(actor)) {
    throw new AppError("Only the owner can change visibility or capacity", 403, "FORBIDDEN");
  }
  if (patch.maxMembers !== undefined && patch.maxMembers < memberCount) {
    throw new AppError("Capacity cannot be lower than the current member count", 400, "VALIDATION_ERROR");
  }
}
