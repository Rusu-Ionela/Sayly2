import { Router } from "express";

import { discoveryLimiter, groupCreateLimiter } from "../../infra/limiter/middleware";
import { authenticate } from "../../shared/middleware/authenticate";

import * as controller from "./controller";

/**
 * Mounted at /party-rooms. REST only covers the lobby and creation; joining, stage controls,
 * reactions and WebRTC signalling run over the socket (PARTY_EVENTS).
 */
export const partyRoomsRouter = Router();

partyRoomsRouter.get("/", authenticate, discoveryLimiter, controller.listRooms);
partyRoomsRouter.post("/", authenticate, groupCreateLimiter, controller.createRoom);
partyRoomsRouter.get("/:id", authenticate, discoveryLimiter, controller.getRoom);
