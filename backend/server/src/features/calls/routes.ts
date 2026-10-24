import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate";
import { requireUserId } from "../../shared/middleware/requireUserId";
import { iceServers } from "./service";

/** Mounted at /calls. */
export const callsRouter = Router();

callsRouter.get("/ice-servers", authenticate, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ iceServers: iceServers(requireUserId(req)) });
});
