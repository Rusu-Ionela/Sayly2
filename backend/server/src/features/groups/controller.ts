import type { Request, Response } from "express";

import { requireUserId } from "../../shared/middleware/requireUserId";
import { requireParam } from "../../shared/utils/requireParam";
import { emitToUsers } from "../messaging/gateway";

import {
  changeRoleSchema,
  createGroupSchema,
  listGroupMessagesQuerySchema,
  listGroupsQuerySchema,
  listMembersQuerySchema,
  sendGroupMessageSchema,
  transferOwnershipSchema,
  updateGroupSchema,
} from "./schema";
import * as groupsService from "./service";
import type { MembershipChange } from "./types";

function respondWithChange(res: Response, change: MembershipChange) {
  for (const item of change.notify) {
    emitToUsers(item.userIds, item.event, item.payload);
  }
  res.json(change.group);
}

export async function listGroups(req: Request, res: Response) {
  res.json(await groupsService.listGroups(requireUserId(req), listGroupsQuerySchema.parse(req.query)));
}

export async function createGroup(req: Request, res: Response) {
  const body = createGroupSchema.parse(req.body);
  res.status(201).json(await groupsService.createGroup(requireUserId(req), body));
}

export async function getGroup(req: Request, res: Response) {
  res.json(await groupsService.getGroupDetail(requireUserId(req), requireParam(req, "id")));
}

export async function updateGroup(req: Request, res: Response) {
  const body = updateGroupSchema.parse(req.body);
  res.json(await groupsService.updateGroup(requireUserId(req), requireParam(req, "id"), body));
}

export async function deleteGroup(req: Request, res: Response) {
  const groupId = requireParam(req, "id");
  const { memberIds } = await groupsService.deleteGroup(requireUserId(req), groupId);
  emitToUsers(memberIds, "group_membership", { groupId, type: "DELETED" });
  res.status(204).send();
}

export async function joinGroup(req: Request, res: Response) {
  respondWithChange(res, await groupsService.joinGroup(requireUserId(req), requireParam(req, "id")));
}

export async function leaveGroup(req: Request, res: Response) {
  res.json(await groupsService.leaveGroup(requireUserId(req), requireParam(req, "id")));
}

export async function listMembers(req: Request, res: Response) {
  const { status } = listMembersQuerySchema.parse(req.query);
  res.json({ items: await groupsService.listMembers(requireUserId(req), requireParam(req, "id"), status) });
}

export async function approveMember(req: Request, res: Response) {
  respondWithChange(
    res,
    await groupsService.approveMember(requireUserId(req), requireParam(req, "id"), requireParam(req, "userId")),
  );
}

export async function removeMember(req: Request, res: Response) {
  respondWithChange(
    res,
    await groupsService.removeMember(requireUserId(req), requireParam(req, "id"), requireParam(req, "userId")),
  );
}

export async function changeRole(req: Request, res: Response) {
  const { role } = changeRoleSchema.parse(req.body);
  respondWithChange(
    res,
    await groupsService.changeRole(requireUserId(req), requireParam(req, "id"), requireParam(req, "userId"), role),
  );
}

export async function transferOwnership(req: Request, res: Response) {
  const { userId } = transferOwnershipSchema.parse(req.body);
  respondWithChange(res, await groupsService.transferOwnership(requireUserId(req), requireParam(req, "id"), userId));
}

export async function listMessages(req: Request, res: Response) {
  const query = listGroupMessagesQuerySchema.parse(req.query);
  res.json(await groupsService.listGroupMessages(requireUserId(req), requireParam(req, "id"), query));
}

export async function sendMessage(req: Request, res: Response) {
  const body = sendGroupMessageSchema.parse(req.body);
  const result = await groupsService.sendGroupMessage(requireUserId(req), requireParam(req, "id"), body);
  if (result.created) {
    emitToUsers(result.recipientIds, "group_message_new", result.message);
  }
  res.status(result.created ? 201 : 200).json(result.message);
}

export async function markRead(req: Request, res: Response) {
  await groupsService.markGroupRead(requireUserId(req), requireParam(req, "id"));
  res.status(204).send();
}
