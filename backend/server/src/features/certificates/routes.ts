import { Router } from "express";

import { authenticate } from "../../shared/middleware/authenticate";

import { CERTIFICATE_OFFERS } from "./catalog";

export const certificatesRouter = Router();

/** GET /certificates/offers — language test levels, format and pricing. */
certificatesRouter.get("/offers", authenticate, (_req, res) => {
  res.json(CERTIFICATE_OFFERS);
});
