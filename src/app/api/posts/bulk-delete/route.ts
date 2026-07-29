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

type DeleteResult = {
  postId: string;
  success: boolean;
  message: string;
  details?: string[];
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

async function deleteOnePost(
  apiKey: string,
  post: NonNullable<BulkDeleteInput["posts"]>[number]
): Promise<DeleteResult | null> {
  const postId = post.postId?.trim();
  if (!postId) return null;

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

  const unpublishResults = await Promise.all(
    uniquePlatforms.map(async (platform) => {
      try {
        await zernioRequest(apiKey, `/posts/${postId}/unpublish`, {
          method: "POST",
          body: { platform },
        });
        return { platform, ok: true as const };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown unpublish error";
        return { platform, ok: false as const, message };
      }
    })
  );

  let unpublishFailures = 0;
  for (const result of unpublishResults) {
    if (!result.ok) {
      unpublishFailures += 1;
      details.push(`Failed to unpublish ${result.platform}: ${result.message}`);
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
    return {
      postId,
      success: true,
      message: "Deleted",
      details: details.length > 0 ? details : undefined,
    };
  }

  if (uniquePlatforms.length > 0 && unpublishFailures < uniquePlatforms.length) {
    return {
      postId,
      success: true,
      message: "Unpublished from social platforms but record deletion failed",
      details,
    };
  }

  return {
    postId,
    success: false,
    message: "Delete failed",
    details,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { zernioApiKey: apiKey } = await requireUserZernioKey(request);
    const body = (await request.json()) as BulkDeleteInput;
    const posts = Array.isArray(body?.posts) ? body.posts : [];

    if (posts.length === 0) {
      return NextResponse.json({ error: "No posts provided" }, { status: 400 });
    }

    const settled = await Promise.all(
      posts.map((post) => deleteOnePost(apiKey, post))
    );
    const results = settled.filter((r): r is DeleteResult => r !== null);

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
