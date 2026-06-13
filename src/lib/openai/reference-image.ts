export type ReferenceImageFile = {
  buffer: Buffer;
  mime: string;
  filename: string;
};

const MAX_REFERENCE_BYTES = 20 * 1024 * 1024;

export async function loadReferenceImage(
  imageUrl: string
): Promise<ReferenceImageFile> {
  const trimmed = imageUrl.trim();
  if (!trimmed) {
    throw new Error("Reference image URL is empty.");
  }

  if (trimmed.startsWith("data:")) {
    const match = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.+)$/i.exec(trimmed);
    if (!match?.[2]) {
      throw new Error("Invalid reference image data URL.");
    }
    const mime = (match[1] || "image/png").toLowerCase();
    const buffer = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
    if (buffer.byteLength > MAX_REFERENCE_BYTES) {
      throw new Error("Reference image is too large (max 20 MB).");
    }
    const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
    return { buffer, mime, filename: `reference.${ext}` };
  }

  const res = await fetch(trimmed);
  if (!res.ok) {
    throw new Error(`Could not load reference image (HTTP ${res.status}).`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.byteLength > MAX_REFERENCE_BYTES) {
    throw new Error("Reference image is too large (max 20 MB).");
  }
  const mime =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
  return { buffer, mime, filename: `reference.${ext}` };
}

export async function loadReferenceImages(
  urls: string[]
): Promise<ReferenceImageFile[]> {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  if (unique.length > 16) {
    throw new Error("At most 16 reference images are supported.");
  }
  return Promise.all(unique.map((url) => loadReferenceImage(url)));
}

export function appendReferenceImagesToFormData(
  form: FormData,
  files: ReferenceImageFile[]
): void {
  for (const file of files) {
    const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mime });
    form.append("image[]", blob, file.filename);
  }
}
