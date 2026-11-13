import "server-only";

import sharp from "sharp";

/** Final size for generated post images (square feed format). */
export const POST_IMAGE_OUTPUT_SIZE = 1080;

/**
 * Resize a generated image to exactly POST_IMAGE_OUTPUT_SIZE square PNG.
 * Takes base64 or a URL; returns base64. Center-crops if the source is not
 * square. Returns null on failure so callers can keep the original.
 */
export async function toSquarePostImage(input: {
  b64_json?: string | null;
  url?: string | null;
}): Promise<string | null> {
  try {
    let source: Buffer | null = null;
    if (input.b64_json) {
      source = Buffer.from(input.b64_json, "base64");
    } else if (input.url) {
      const res = await fetch(input.url);
      if (!res.ok) return null;
      source = Buffer.from(await res.arrayBuffer());
    }
    if (!source?.length) return null;

    const out = await sharp(source)
      .resize(POST_IMAGE_OUTPUT_SIZE, POST_IMAGE_OUTPUT_SIZE, {
        fit: "cover",
        position: "centre",
        kernel: "lanczos3",
      })
      .png()
      .toBuffer();
    return out.toString("base64");
  } catch (error) {
    console.warn("Square post image resize failed:", (error as Error).message);
    return null;
  }
}
