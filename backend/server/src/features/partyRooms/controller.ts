import type { Request, Response } from "express";
import { createPartyRoomSchema, listPartyRoomsQuerySchema } from "@sayly/shared";

import { requireUserId } from "../../shared/middleware/requireUserId";
import { requireParam } from "../../shared/utils/requireParam";

import * as service from "./service";

export async function listRooms(req: Request, res: Response) {
  res.json({ items: await service.listRooms(requireUserId(req), listPartyRoomsQuerySchema.parse(req.query)) });
}

export async function createRoom(req: Request, res: Response) {
  const body = createPartyRoomSchema.parse(req.body);
  res.status(201).json(await service.createRoom(requireUserId(req), body));
}

export async function getRoom(req: Request, res: Response) {
  res.json(await service.getRoom(requireUserId(req), requireParam(req, "id")));
}
