import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { logger } from "../utils/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  req.requestId = randomUUID();
  res.setHeader("X-Request-Id", req.requestId);

  const started = Date.now();

  logger.debug("http", "request", {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
  });

  res.on("finish", () => {
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logger[level]("http", "response", {
      requestId: req.requestId,
      method: req.method,
      path: req.route?.path ? req.baseUrl + String(req.route.path) : req.path,
      status: res.statusCode,
      durationMs: Date.now() - started,
    });
  });

  next();
}
