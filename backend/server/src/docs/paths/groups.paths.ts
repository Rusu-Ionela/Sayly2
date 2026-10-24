import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import {
  changeRoleSchema,
  createGroupSchema,
  listGroupMessagesQuerySchema,
  listGroupsQuerySchema,
  listMembersQuerySchema,
  sendGroupMessageSchema,
  transferOwnershipSchema,
  updateGroupSchema,
} from "../../features/groups/schema";
import { bearerAuth, commonErrorResponses } from "../components/responses";

const groupIdParams = z.object({ id: z.string() });
const memberParams = z.object({ id: z.string(), userId: z.string() });
const json = (description: string) => ({ description, content: { "application/json": { schema: z.object({}).passthrough() } } });
const errors = {
  400: commonErrorResponses[400]!,
  401: commonErrorResponses[401]!,
  404: commonErrorResponses[404]!,
};
const body = (schema: z.ZodTypeAny) => ({ body: { required: true, content: { "application/json": { schema } } } });

type Route = {
  method: "get" | "post" | "patch" | "delete";
  path: string;
  summary: string;
  description?: string;
  request?: Record<string, unknown>;
  ok?: number;
};

const routes: Route[] = [
  { method: "get", path: "/groups", summary: "Browse or list my groups", request: { query: listGroupsQuerySchema } },
  { method: "post", path: "/groups", summary: "Create a group (creator becomes OWNER)", request: body(createGroupSchema), ok: 201 },
  { method: "get", path: "/groups/{id}", summary: "Group detail with viewer membership", request: { params: groupIdParams } },
  { method: "patch", path: "/groups/{id}", summary: "Edit group (moderators; visibility/capacity owner-only)", request: { params: groupIdParams, ...body(updateGroupSchema) } },
  { method: "delete", path: "/groups/{id}", summary: "Delete group (owner only, soft delete)", request: { params: groupIdParams }, ok: 204 },
  { method: "post", path: "/groups/{id}/join", summary: "Join a public group or request to join a private one", request: { params: groupIdParams } },
  { method: "post", path: "/groups/{id}/leave", summary: "Leave a group or withdraw a request (owner must transfer first)", request: { params: groupIdParams } },
  { method: "post", path: "/groups/{id}/transfer", summary: "Transfer ownership to an active member", request: { params: groupIdParams, ...body(transferOwnershipSchema) } },
  { method: "get", path: "/groups/{id}/members", summary: "Members (members only) or pending requests (moderators only)", request: { params: groupIdParams, query: listMembersQuerySchema } },
  { method: "post", path: "/groups/{id}/members/{userId}/approve", summary: "Approve a pending join request (moderators)", request: { params: memberParams } },
  { method: "patch", path: "/groups/{id}/members/{userId}", summary: "Promote/demote a member (owner only)", request: { params: memberParams, ...body(changeRoleSchema) } },
  { method: "delete", path: "/groups/{id}/members/{userId}", summary: "Remove a member or reject a request (moderators)", request: { params: memberParams } },
  { method: "get", path: "/groups/{id}/messages", summary: "Group discussion history, newest page first (members only)", request: { params: groupIdParams, query: listGroupMessagesQuerySchema } },
  {
    method: "post",
    path: "/groups/{id}/messages",
    summary: "Post to the group discussion (members only)",
    description: "Idempotent per clientMessageId. Emits `group_message_new` to every active member's socket room.",
    request: { params: groupIdParams, ...body(sendGroupMessageSchema) },
    ok: 201,
  },
  { method: "patch", path: "/groups/{id}/read", summary: "Mark the group discussion as read", request: { params: groupIdParams }, ok: 204 },
];

export function registerGroupPaths(registry: OpenAPIRegistry) {
  for (const route of routes) {
    registry.registerPath({
      method: route.method,
      path: route.path,
      tags: ["Groups"],
      summary: route.summary,
      description: route.description,
      security: bearerAuth,
      request: route.request,
      responses: {
        [route.ok ?? 200]: route.ok === 204 ? { description: "Done" } : json("Success"),
        ...errors,
        403: commonErrorResponses[403] ?? json("Forbidden"),
        409: commonErrorResponses[409] ?? json("Conflict"),
      },
    });
  }
}
