import { createLateClient } from "@/lib/late-api";

export type UploadedServerMedia = {
  url: string;
  type: "image" | "video";
  filename: string;
  contentType: string;
};

function getExtension(contentType: string, type: "image" | "video"): string {
  const [, rawSubtype = "bin"] = contentType.split("/");
  const subtype = rawSubtype.split(";")[0].trim().toLowerCase();
  if (subtype === "jpeg") return "jpg";
  if (subtype) return subtype;
  return type === "video" ? "mp4" : "png";
}

async function loadMediaBytes(
  sourceUrl: string,
  type: "image" | "video"
): Promise<{ buffer: Buffer; contentType: string }> {
  const trimmed = sourceUrl.trim();

  if (trimmed.startsWith("data:")) {
    const match =
      /^data:([^;,]+)?(?:;charset=[^;,]+)?(?:;base64)?,(.*)$/i.exec(trimmed);
    if (!match?.[2]) {
      throw new Error(`Invalid ${type} data URL`);
    }
    const contentType =
      match[1]?.trim() || (type === "video" ? "video/mp4" : "image/png");
    const isBase64 = /;base64/i.test(trimmed);
    const payload = match[2].replace(/\s+/g, "");
    const buffer = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
    if (!buffer.length) {
      throw new Error(`Empty ${type} data URL`);
    }
    return { buffer, contentType };
  }

  const response = await fetch(trimmed);
  if (!response.ok) {
    throw new Error(`Failed to download ${type} before upload`);
  }
  const contentType =
    response.headers.get("content-type") ??
    (type === "video" ? "video/mp4" : "image/png");
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType,
  };
}

export async function uploadMediaFromUrl(
  apiKey: string,
  sourceUrl: string,
  type: "image" | "video",
  filenamePrefix: string
): Promise<UploadedServerMedia> {
  const { buffer, contentType } = await loadMediaBytes(sourceUrl, type);
  const extension = getExtension(contentType, type);
  const filename = `${filenamePrefix}.${extension}`;

  const late = createLateClient(apiKey);
  const { data, error } = await late.media.getMediaPresignedUrl({
    body: { filename, contentType },
  });
  if (error || !data?.uploadUrl || !data.publicUrl) {
    throw new Error("Failed to get media upload URL from Zernio");
  }

  const uploadResponse = await fetch(data.uploadUrl, {
    method: "PUT",
    body: new Uint8Array(buffer),
    headers: {
      "Content-Type": contentType,
    },
  });
  if (!uploadResponse.ok) {
    throw new Error("Failed to upload generated media to Zernio");
  }

  return {
    url: data.publicUrl,
    type,
    filename,
    contentType,
  };
}
