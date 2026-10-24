import { existsSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

import { describe, expect, it } from "vitest";

import { createOwnedUpload, requireOwnedMediaPath } from "./service";
import { inspectUploadedFile, safeStorageKey } from "./storage";

describe("media safety", () => {
  it("only accepts cuid-style storage keys", () => {
    expect(safeStorageKey("abc123.jpg")).toBe("abc123.jpg");
    expect(safeStorageKey("../etc/passwd")).toBeNull();
    expect(safeStorageKey("%")).toBeNull();
    expect(safeStorageKey("a_b.jpg")).toBeNull();
  });

  it("rejects media references that are not server uploads", async () => {
    await expect(requireOwnedMediaPath("user-1", "https://tracker.example/pixel.jpg")).rejects.toThrow(
      "Media must be a file you uploaded",
    );
  });

  it("checks file bytes against the declared type", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sayly-sniff-"));
    const jpeg = path.join(dir, "ok.jpg");
    const fake = path.join(dir, "fake.jpg");
    writeFileSync(jpeg, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]));
    writeFileSync(fake, "just some text pretending to be an image");

    await expect(inspectUploadedFile(jpeg, "image/jpeg")).resolves.toBeUndefined();
    await expect(inspectUploadedFile(fake, "image/jpeg")).rejects.toThrow("not allowed");
  });

  it("deletes a rejected upload from disk", async () => {
    const filePath = path.join(mkdtempSync(path.join(tmpdir(), "sayly-upload-")), "x.jpg");
    writeFileSync(filePath, "<html><script>alert(1)</script></html>");

    await expect(
      createOwnedUpload("user-1", { path: filePath, size: 40 } as Express.Multer.File),
    ).rejects.toThrow("This file type is not allowed");
    expect(existsSync(filePath)).toBe(false);
  });
});
