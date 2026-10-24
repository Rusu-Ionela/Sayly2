import type { Request, Response } from "express";

import * as languagesService from "./service";

/** LANG-001P0 GET /languages */
export async function listLanguages(_req: Request, res: Response) {
  res.json(await languagesService.listLanguages());
}
