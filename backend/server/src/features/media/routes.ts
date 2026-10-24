import { createReadStream } from "fs";
import path from "path";

import { Router } from "express";

import { AppError } from "../../shared/errors/AppError";
import { authenticate, optionalAuthenticate } from "../../shared/middleware/authenticate";
import { uploadLimiter } from "../../infra/limiter/middleware";
import * as controller from "./controller";
import { mimeTypeForStorageKey, userCanAccessStorageKey } from "./service";
import { chatUpload, safeStorageKey, UPLOADS_DIR, verifySignedFileUrl } from "./storage";

export const mediaRouter = Router();

mediaRouter.get("/files/:filename", optionalAuthenticate, async (req, res, next) => {
  try {
    const rawName = req.params.filename;
    const filename = safeStorageKey(typeof rawName === "string" ? rawName : "");
    if (!filename) {
      throw new AppError("Not found", 404, "NOT_FOUND");
    }

    const exp = typeof req.query.exp === "string" ? req.query.exp : undefined;
    const sig = typeof req.query.sig === "string" ? req.query.sig : undefined;
    const signedOk = verifySignedFileUrl(filename, exp, sig);
    const userId = req.user?.id;

    if (!signedOk) {
      if (!userId || !(await userCanAccessStorageKey(userId, filename))) {
        throw new AppError("Not found", 404, "NOT_FOUND");
      }
    }

    const mimeType = await mimeTypeForStorageKey(filename);
    if (mimeType) {
      res.type(mimeType);
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'none'; sandbox");
    res.setHeader("Cache-Control", "private, max-age=300");
    createReadStream(path.join(UPLOADS_DIR, filename))
      .on("error", () => {
        next(new AppError("Not found", 404, "NOT_FOUND"));
      })
      .pipe(res);
  } catch (error) {
    next(error);
  }
});

mediaRouter.post(
  "/uploads",
  authenticate,
  uploadLimiter,
  (req, res, next) => {
    chatUpload.single("file")(req, res, (error: unknown) => {
      if (!error) {
        next();
        return;
      }
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
      if (code === "LIMIT_FILE_SIZE") {
        next(new AppError("File is too large (max 40 MB)", 400, "VALIDATION_ERROR"));
        return;
      }
      next(new AppError("This file type is not allowed", 400, "VALIDATION_ERROR"));
    });
  },
  controller.createUpload,
);
