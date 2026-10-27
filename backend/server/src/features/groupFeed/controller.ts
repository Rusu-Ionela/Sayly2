import type { Request, Response } from "express";
import {
  createGroupCommentSchema,
  createGroupPostSchema,
  groupFeedPageQuerySchema,
  setGroupPostReactionSchema,
} from "@sayly/shared";

import { requireUserId } from "../../shared/middleware/requireUserId";
import { requireParam } from "../../shared/utils/requireParam";

import * as service from "./service";

/** Mounted with mergeParams under /groups/:id/posts, so `id` is the group id. */
const groupIdOf = (req: Request) => requireParam(req, "id");

export async function listPosts(req: Request, res: Response) {
  const query = groupFeedPageQuerySchema.parse(req.query);
  res.json(await service.listPosts(requireUserId(req), groupIdOf(req), query));
}

export async function getPost(req: Request, res: Response) {
  res.json(await service.getPost(requireUserId(req), groupIdOf(req), requireParam(req, "postId")));
}

export async function createPost(req: Request, res: Response) {
  const body = createGroupPostSchema.parse(req.body);
  const result = await service.createPost(requireUserId(req), groupIdOf(req), body);
  res.status(result.created ? 201 : 200).json(result.post);
}

export async function deletePost(req: Request, res: Response) {
  await service.deletePost(requireUserId(req), groupIdOf(req), requireParam(req, "postId"));
  res.status(204).send();
}

export async function setReaction(req: Request, res: Response) {
  const { kind } = setGroupPostReactionSchema.parse(req.body);
  res.json(await service.setReaction(requireUserId(req), groupIdOf(req), requireParam(req, "postId"), kind));
}

export async function clearReaction(req: Request, res: Response) {
  res.json(await service.setReaction(requireUserId(req), groupIdOf(req), requireParam(req, "postId"), null));
}

export async function listComments(req: Request, res: Response) {
  const query = groupFeedPageQuerySchema.parse(req.query);
  res.json(await service.listComments(requireUserId(req), groupIdOf(req), requireParam(req, "postId"), query));
}

export async function createComment(req: Request, res: Response) {
  const body = createGroupCommentSchema.parse(req.body);
  const result = await service.createComment(requireUserId(req), groupIdOf(req), requireParam(req, "postId"), body);
  res.status(result.created ? 201 : 200).json(result.comment);
}

export async function deleteComment(req: Request, res: Response) {
  await service.deleteComment(
    requireUserId(req),
    groupIdOf(req),
    requireParam(req, "postId"),
    requireParam(req, "commentId"),
  );
  res.status(204).send();
}
