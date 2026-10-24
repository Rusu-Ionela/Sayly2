import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { AppError } from "../../shared/errors/AppError";

vi.mock("../../shared/middleware/authenticate", () => ({
  optionalAuthenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
  authenticate: (
    req: { get: (name: string) => string | undefined; userId?: string; user?: { id: string } },
    _res: unknown,
    next: (err?: unknown) => void,
  ) => {
    if (!req.get("authorization")) {
      next(new AppError("Authentication required", 401, "UNAUTHORIZED"));
      return;
    }
    req.userId = "viewer-1";
    req.user = { id: "viewer-1" };
    next();
  },
}));

vi.mock("./service", () => ({
  listGroups: vi.fn(),
  createGroup: vi.fn(),
  getGroupDetail: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  joinGroup: vi.fn(),
  leaveGroup: vi.fn(),
  listMembers: vi.fn(),
  approveMember: vi.fn(),
  removeMember: vi.fn(),
  changeRole: vi.fn(),
  transferOwnership: vi.fn(),
  listGroupMessages: vi.fn(),
  sendGroupMessage: vi.fn(),
  markGroupRead: vi.fn(),
}));

vi.mock("../messaging/gateway", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../messaging/gateway")>()),
  emitToUsers: vi.fn(),
}));

import { buildOpenApiDocument } from "../../docs/openapi";
import { createApp } from "../../lib/app";
import { emitToUsers } from "../messaging/gateway";
import * as policy from "./policy";
import { createGroupSchema, listGroupsQuerySchema, updateGroupSchema } from "./schema";
import * as groupsService from "./service";

const app = createApp();
const auth = { Authorization: "Bearer test" };

const owner = { role: "OWNER", status: "ACTIVE" } as const;
const moderator = { role: "MODERATOR", status: "ACTIVE" } as const;
const member = { role: "MEMBER", status: "ACTIVE" } as const;
const pending = { role: "MEMBER", status: "PENDING" } as const;
const publicGroup = { visibility: "PUBLIC", memberCount: 3, maxMembers: 10 } as const;

function expectAppError(fn: () => unknown, status: number) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(status);
    return;
  }
  throw new Error("expected AppError");
}

describe("group policy", () => {
  it("admits public joins immediately and queues private ones", () => {
    expect(policy.joinOutcome(publicGroup, null)).toBe("ACTIVE");
    expect(policy.joinOutcome({ ...publicGroup, visibility: "PRIVATE" }, null)).toBe("PENDING");
  });

  it("rejects duplicate joins and full groups", () => {
    expectAppError(() => policy.joinOutcome(publicGroup, member), 409);
    expectAppError(() => policy.joinOutcome(publicGroup, pending), 409);
    expectAppError(() => policy.joinOutcome({ ...publicGroup, memberCount: 10 }, null), 409);
  });

  it("keeps discussion and members private to active members", () => {
    expectAppError(() => policy.assertCanReadContent(null), 403);
    expectAppError(() => policy.assertCanReadContent(pending), 403);
    expect(() => policy.assertCanReadContent(member)).not.toThrow();
  });

  it("stops the owner from leaving without a successor", () => {
    expectAppError(() => policy.assertCanLeave(owner), 409);
    expectAppError(() => policy.assertCanLeave(null), 404);
    expect(() => policy.assertCanLeave(member)).not.toThrow();
    expect(() => policy.assertCanLeave(pending)).not.toThrow();
  });

  it("lets moderators remove members but only owners remove moderators", () => {
    expect(() => policy.assertCanRemove("m", moderator, "u", member)).not.toThrow();
    expectAppError(() => policy.assertCanRemove("m", moderator, "u2", moderator), 403);
    expect(() => policy.assertCanRemove("o", owner, "u2", moderator)).not.toThrow();
    expectAppError(() => policy.assertCanRemove("m", moderator, "o", owner), 403);
    expectAppError(() => policy.assertCanRemove("u", member, "u2", member), 403);
    expectAppError(() => policy.assertCanRemove("m", moderator, "m", moderator), 400);
  });

  it("lets moderators approve only pending requests", () => {
    expect(() => policy.assertCanApprove(moderator, pending)).not.toThrow();
    expectAppError(() => policy.assertCanApprove(member, pending), 403);
    expectAppError(() => policy.assertCanApprove(moderator, member), 404);
  });

  it("restricts role changes and transfers to the owner", () => {
    expect(() => policy.assertCanChangeRole(owner, member, "MODERATOR")).not.toThrow();
    expectAppError(() => policy.assertCanChangeRole(moderator, member, "MODERATOR"), 403);
    expectAppError(() => policy.assertCanChangeRole(owner, member, "OWNER"), 400);
    expectAppError(() => policy.assertCanChangeRole(owner, pending, "MODERATOR"), 404);
    expect(() => policy.assertCanTransfer("o", owner, "u", member)).not.toThrow();
    expectAppError(() => policy.assertCanTransfer("o", owner, "u", pending), 400);
    expectAppError(() => policy.assertCanTransfer("m", moderator, "u", member), 403);
  });

  it("keeps visibility and capacity owner-only", () => {
    expect(() => policy.assertCanEdit(moderator, { maxMembers: undefined }, 3)).not.toThrow();
    expectAppError(() => policy.assertCanEdit(moderator, { visibility: "PRIVATE" }, 3), 403);
    expectAppError(() => policy.assertCanEdit(owner, { maxMembers: 2 }, 3), 400);
    expectAppError(() => policy.assertCanEdit(member, {}, 3), 403);
  });
});

describe("group validation", () => {
  it("applies safe defaults and trims input", () => {
    expect(createGroupSchema.parse({ name: "  Hindi club ", languageId: "hi" })).toMatchObject({
      name: "Hindi club",
      visibility: "PUBLIC",
      level: null,
      maxMembers: 200,
    });
  });

  it("rejects protected fields (mass assignment) and bad values", () => {
    expect(createGroupSchema.safeParse({ name: "Club", languageId: "hi", ownerId: "x" }).success).toBe(false);
    expect(createGroupSchema.safeParse({ name: "Club", languageId: "hi", memberCount: 0 }).success).toBe(false);
    expect(createGroupSchema.safeParse({ name: "ab", languageId: "hi" }).success).toBe(false);
    expect(createGroupSchema.safeParse({ name: "Club", languageId: "hi", level: "GURU" }).success).toBe(false);
    expect(createGroupSchema.safeParse({ name: "Club", languageId: "hi", topic: "Dating" }).success).toBe(false);
    expect(updateGroupSchema.safeParse({}).success).toBe(false);
  });

  it("parses list filters", () => {
    expect(listGroupsQuerySchema.parse({ scope: "mine", level: "", page: "2" })).toMatchObject({
      scope: "mine",
      level: undefined,
      page: 2,
      sort: "active",
    });
  });
});

describe("groups HTTP", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    const res = await request(app).get("/groups");
    expect(res.status).toBe(401);
    expect(groupsService.listGroups).not.toHaveBeenCalled();
  });

  it("creates a group as the authenticated user only", async () => {
    vi.mocked(groupsService.createGroup).mockResolvedValue({ id: "g1" } as never);
    const res = await request(app).post("/groups").set(auth).send({ name: "Hindi club", languageId: "hi" });
    expect(res.status).toBe(201);
    expect(groupsService.createGroup).toHaveBeenCalledWith("viewer-1", expect.objectContaining({ name: "Hindi club" }));
  });

  it("returns 400 for invalid bodies and ids", async () => {
    expect((await request(app).post("/groups").set(auth).send({ name: "x" })).status).toBe(400);
    expect((await request(app).get("/groups/bad%20id").set(auth)).status).toBe(400);
  });

  it("notifies moderators when a private join is requested", async () => {
    vi.mocked(groupsService.joinGroup).mockResolvedValue({
      group: { id: "g1" } as never,
      notify: [{ userIds: ["mod-1"], event: "group_membership", payload: { groupId: "g1", type: "REQUESTED" } }],
    });
    const res = await request(app).post("/groups/g1/join").set(auth);
    expect(res.status).toBe(200);
    expect(emitToUsers).toHaveBeenCalledWith(["mod-1"], "group_membership", { groupId: "g1", type: "REQUESTED" });
  });

  it("surfaces policy errors with their status", async () => {
    vi.mocked(groupsService.listGroupMessages).mockRejectedValue(new AppError("Join first", 403, "FORBIDDEN"));
    const res = await request(app).get("/groups/g1/messages").set(auth);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("broadcasts new group messages to members, but not idempotent replays", async () => {
    const message = { id: "m1", groupId: "g1" };
    vi.mocked(groupsService.sendGroupMessage).mockResolvedValueOnce({
      message: message as never,
      recipientIds: ["viewer-1", "u2"],
      created: true,
    });
    const first = await request(app).post("/groups/g1/messages").set(auth).send({ content: "Привет", clientMessageId: "client-123" });
    expect(first.status).toBe(201);
    expect(emitToUsers).toHaveBeenCalledWith(["viewer-1", "u2"], "group_message_new", message);

    vi.mocked(emitToUsers).mockClear();
    vi.mocked(groupsService.sendGroupMessage).mockResolvedValueOnce({ message: message as never, recipientIds: [], created: false });
    const replay = await request(app).post("/groups/g1/messages").set(auth).send({ content: "Привет", clientMessageId: "client-123" });
    expect(replay.status).toBe(200);
    expect(emitToUsers).not.toHaveBeenCalled();
  });

  it("validates role changes before reaching the service", async () => {
    const res = await request(app).patch("/groups/g1/members/u2").set(auth).send({ role: "OWNER" });
    expect(res.status).toBe(400);
    expect(groupsService.changeRole).not.toHaveBeenCalled();
  });
});

describe("groups OpenAPI", () => {
  it("documents every groups route", () => {
    const doc = buildOpenApiDocument() as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths).filter((path) => path.startsWith("/groups"))).toHaveLength(10);
  });
});
