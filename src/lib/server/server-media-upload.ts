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

export async function uploadMediaFromUrl(
  apiKey: string,
  sourceUrl: string,
  type: "image" | "video",
  filenamePrefix: string
): Promise<UploadedServerMedia> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ${type} before upload`);
  }

  const contentType =
    response.headers.get("content-type") ??
    (type === "video" ? "video/mp4" : "image/png");
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
    body: Buffer.from(await response.arrayBuffer()),
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
