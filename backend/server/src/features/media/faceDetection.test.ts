import sharp, { type Sharp } from "sharp";
import { describe, expect, it } from "vitest";

import { assertHumanFacePhoto, containsHumanFace, FACE_REQUIRED_MESSAGE } from "./faceDetection";

/** An emoji-style smiley: a face-like drawing, not a photo of a person. */
function smileySvg() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <rect width="512" height="512" fill="#ffffff"/>
    <circle cx="256" cy="256" r="220" fill="#FFCC33" stroke="#E0A800" stroke-width="10"/>
    <circle cx="180" cy="200" r="28" fill="#5B3A00"/>
    <circle cx="332" cy="200" r="28" fill="#5B3A00"/>
    <path d="M150 300 Q256 410 362 300" stroke="#5B3A00" stroke-width="22" fill="none"/>
  </svg>`);
}

function jpeg(image: Sharp) {
  return image.jpeg().toBuffer();
}

// The first test loads the model (WASM + weights), so allow it some time.
describe("profile photo face check", { timeout: 60_000 }, () => {
  it("finds no face in an emoji-style drawing", async () => {
    expect(await containsHumanFace(await jpeg(sharp(smileySvg())))).toBe(false);
  });

  it("finds no face in a plain picture", async () => {
    const plain = await jpeg(
      sharp({ create: { width: 400, height: 300, channels: 3, background: "#7FA7C9" } }),
    );
    expect(await containsHumanFace(plain)).toBe(false);
  });

  it("rejects photos without a face with the user-facing message", async () => {
    await expect(assertHumanFacePhoto(await jpeg(sharp(smileySvg())))).rejects.toMatchObject({
      statusCode: 400,
      message: FACE_REQUIRED_MESSAGE,
    });
  });

  it("treats undecodable bytes as an invalid photo, not a server error", async () => {
    await expect(assertHumanFacePhoto(Buffer.from("not an image"))).rejects.toMatchObject({
      statusCode: 400,
      message: FACE_REQUIRED_MESSAGE,
    });
  });
});
