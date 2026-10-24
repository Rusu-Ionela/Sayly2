import path from "path";

import * as tf from "@tensorflow/tfjs";
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm";
import * as faceapi from "@vladmandic/face-api/dist/face-api.node-wasm.js";
import sharp from "sharp";

import { AppError } from "../../shared/errors/AppError";
import { logger } from "../../shared/utils/logger";

export const FACE_REQUIRED_MESSAGE =
  "Poza de profil trebuie să conțină o fotografie reală cu chipul tău (nu sunt permise emoji-uri sau imagini abstracte).";

/** Real photos score ~0.99; emoji and drawings did not register even at 0.3 in testing. */
const MIN_CONFIDENCE = 0.8;
/** A face narrower than this share of the picture is not a portrait of the uploader. */
const MIN_FACE_WIDTH_RATIO = 0.08;
/** Detection runs on a downscaled copy — plenty for faces, cheap on CPU. */
const ANALYSIS_EDGE = 512;
/** Rejects decompression bombs before decoding (avatars are ≤ 2 MB anyway). */
const MAX_INPUT_PIXELS = 40_000_000;

const PACKAGE_DIR = (name: string) =>
  path.dirname(require.resolve(`${name}/package.json`));

let ready: Promise<void> | null = null;

/** Loads the WASM backend and the SSD MobileNet model once, on first use. */
function ensureModel(): Promise<void> {
  ready ??= (async () => {
    setWasmPaths(path.join(PACKAGE_DIR("@tensorflow/tfjs-backend-wasm"), "dist") + path.sep);
    await tf.setBackend("wasm");
    await tf.ready();
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(
      path.join(PACKAGE_DIR("@vladmandic/face-api"), "model"),
    );
  })().catch((error: unknown) => {
    ready = null; // allow a retry on the next upload
    throw error;
  });
  return ready;
}

/** Inference is CPU-bound; running one at a time keeps memory flat under load. */
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function decodeForAnalysis(image: Buffer) {
  const { data, info } = await sharp(image, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate() // honour EXIF orientation, so sideways selfies still match
    .resize(ANALYSIS_EDGE, ANALYSIS_EDGE, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { pixels: new Uint8Array(data), width: info.width, height: info.height };
}

/** True when the image contains at least one clearly visible human face. */
export async function containsHumanFace(image: Buffer): Promise<boolean> {
  await ensureModel();
  const { pixels, width, height } = await decodeForAnalysis(image);

  return serialize(async () => {
    const tensor = tf.tensor3d(pixels, [height, width, 3], "int32");
    try {
      const detections = await faceapi.detectAllFaces(
        tensor as unknown as faceapi.TNetInput,
        new faceapi.SsdMobilenetv1Options({ minConfidence: MIN_CONFIDENCE }),
      );
      return detections.some((detection) => detection.box.width / width >= MIN_FACE_WIDTH_RATIO);
    } finally {
      tensor.dispose();
    }
  });
}

/**
 * Profile photo rule: only real photos showing a human face. Fails closed — if the
 * detector itself is unavailable the upload is refused with a retryable 503.
 */
export async function assertHumanFacePhoto(image: Buffer): Promise<void> {
  let hasFace: boolean;
  try {
    hasFace = await containsHumanFace(image);
  } catch (error) {
    if (error instanceof Error && /unsupported image format|Input buffer/i.test(error.message)) {
      throw new AppError(FACE_REQUIRED_MESSAGE, 400, "VALIDATION_ERROR");
    }
    logger.error("media", "face detection failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    throw new AppError(
      "We could not check your photo right now. Please try again in a moment.",
      503,
      "SERVICE_UNAVAILABLE",
    );
  }

  if (!hasFace) {
    throw new AppError(FACE_REQUIRED_MESSAGE, 400, "VALIDATION_ERROR");
  }
}
