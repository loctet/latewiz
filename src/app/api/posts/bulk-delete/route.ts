import { NextRequest, NextResponse } from "next/server";
import { SessionRequiredError } from "@/lib/server/session";
import { requireUserZernioKey } from "@/lib/server/ai-request-keys";
import { zernioRequest } from "@/lib/zernio-api";

type PostPlatform = {
  platform?: string;
  status?: string;
};

type BulkDeleteInput = {
  posts?: Array<{
    postId?: string;
    status?: string;
    platforms?: PostPlatform[];
  }>;
};

const UNPUBLISHABLE_PLATFORMS = new Set([
  "threads",
  "facebook",
  "twitter",
  "linkedin",
  "youtube",
  "pinterest",
  "reddit",
  "bluesky",
  "googlebusiness",
  "telegram",
]);

function normalizePlatform(platform: string | undefined): string | null {
  if (!platform) return null;
  const normalized = platform.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "x") return "twitter";
  return normalized;
}

function shouldUnpublish(postStatus: string | undefined, platformStatus: string | undefined): boolean {
  return postStatus === "published" || postStatus === "partial" || platformStatus === "published";
}

export async function POST(request: NextRequest) {
  try {
    const { zernioApiKey: apiKey } = await requireUserZernioKey(request);
    const body = (await request.json()) as BulkDeleteInput;
    const posts = Array.isArray(body?.posts) ? body.posts : [];

    if (posts.length === 0) {
      return NextResponse.json({ error: "No posts provided" }, { status: 400 });
    }

    const results: Array<{
      postId: string;
      success: boolean;
      message: string;
      details?: string[];
    }> = [];

    for (const post of posts) {
      const postId = post.postId?.trim();
      if (!postId) continue;

      const details: string[] = [];
      const uniquePlatforms = Array.from(
        new Set(
          (post.platforms ?? [])
            .map((p) => ({
              platform: normalizePlatform(p.platform),
              status: p.status?.toLowerCase(),
            }))
            .filter((p) => p.platform && UNPUBLISHABLE_PLATFORMS.has(p.platform))
            .filter((p) => shouldUnpublish(post.status?.toLowerCase(), p.status))
            .map((p) => p.platform as string)
        )
      );

      let unpublishFailures = 0;
      for (const platform of uniquePlatforms) {
        try {
          await zernioRequest(apiKey, `/posts/${postId}/unpublish`, {
            method: "POST",
            body: { platform },
          });
        } catch (err) {
          unpublishFailures += 1;
          const message =
            err instanceof Error ? err.message : "Unknown unpublish error";
          details.push(`Failed to unpublish ${platform}: ${message}`);
        }
      }

      let deleted = false;
      try {
        await zernioRequest(apiKey, `/posts/${postId}`, { method: "DELETE" });
        deleted = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown delete error";
        details.push(`Failed to delete post record: ${message}`);
      }

      if (deleted) {
        results.push({
          postId,
          success: true,
          message: "Deleted",
          details: details.length > 0 ? details : undefined,
        });
      } else if (uniquePlatforms.length > 0 && unpublishFailures < uniquePlatforms.length) {
        results.push({
          postId,
          success: true,
          message: "Unpublished from social platforms but record deletion failed",
          details,
        });
      } else {
        results.push({
          postId,
          success: false,
          message: "Delete failed",
          details,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
      success: failureCount === 0,
      successCount,
      failureCount,
      results,
    });
  } catch (err) {
    if (err instanceof SessionRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof Error && err.message.includes("Zernio API key")) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("Bulk delete posts error:", err);
    return NextResponse.json(
      { error: "Failed to delete posts" },
      { status: 500 }
    );
  }
}
