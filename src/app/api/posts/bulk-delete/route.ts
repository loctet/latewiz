import { NextRequest, NextResponse } from "next/server";
import { SessionRequiredError } from "@/lib/server/session";
import { requireUserZernioKey } from "@/lib/server/ai-request-keys";
import { zernioRequest, ZernioApiError } from "@/lib/zernio-api";

type PostPlatform = {
  platform?: string;
  status?: string;
  platformPostUrl?: string;
  platformPostId?: string;
  accountId?: string | { platform?: string; _id?: string };
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

type ZernioPost = {
  _id?: string;
  status?: string;
  platforms?: PostPlatform[];
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

const LIVE_PLATFORM_STATUSES = new Set(["published", "success"]);

function normalizePlatform(platform: string | undefined): string | null {
  if (!platform) return null;
  const normalized = platform.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "x") return "twitter";
  return normalized;
}

function platformName(entry: PostPlatform): string | null {
  return (
    normalizePlatform(entry.platform) ??
    normalizePlatform(
      typeof entry.accountId === "object" ? entry.accountId?.platform : undefined
    )
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof ZernioApiError) {
    const body = err.body as
      | { error?: string; message?: string; details?: string }
      | null;
    return (
      body?.error ??
      body?.message ??
      body?.details ??
      err.message ??
      `Zernio error (${err.status})`
    );
  }
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

function isStrictlyLive(entry: PostPlatform): boolean {
  const status = entry.status?.toLowerCase();
  if (status === "failed" || status === "cancelled" || status === "pending") {
    return false;
  }
  if (LIVE_PLATFORM_STATUSES.has(status || "")) return true;
  return Boolean(entry.platformPostUrl || entry.platformPostId);
}

function shouldAttemptUnpublish(entry: PostPlatform, postStatus?: string): boolean {
  if (isStrictlyLive(entry)) return true;
  const status = entry.status?.toLowerCase();
  if (status === "failed" || status === "cancelled" || status === "pending") {
    return false;
  }
  const ps = postStatus?.toLowerCase();
  if (ps === "published" || ps === "partial") {
    return !status || LIVE_PLATFORM_STATUSES.has(status);
  }
  return false;
}

function collectTargets(
  platforms: PostPlatform[] | undefined,
  postStatus: string | undefined,
  mode: "attempt" | "remaining"
): string[] {
  return Array.from(
    new Set(
      (platforms ?? [])
        .filter((p) =>
          mode === "remaining"
            ? isStrictlyLive(p)
            : shouldAttemptUnpublish(p, postStatus)
        )
        .map((p) => platformName(p))
        .filter((p): p is string => !!p && UNPUBLISHABLE_PLATFORMS.has(p))
    )
  );
}

async function fetchPost(
  apiKey: string,
  postId: string
): Promise<ZernioPost | null> {
  try {
    const data = await zernioRequest<{ post?: ZernioPost } & ZernioPost>(
      apiKey,
      `/posts/${postId}`
    );
    return data.post ?? data;
  } catch (err) {
    if (err instanceof ZernioApiError && err.status === 404) return null;
    throw err;
  }
}

async function unpublishPlatforms(
  apiKey: string,
  postId: string,
  platforms: string[],
  details: string[]
): Promise<string[]> {
  const ok: string[] = [];

  for (const platform of platforms) {
    try {
      await zernioRequest(apiKey, `/posts/${postId}/unpublish`, {
        method: "POST",
        body: { platform },
      });
      ok.push(platform);
      details.push(`Unpublished ${platform}`);
    } catch (err) {
      const message = errorMessage(err);
      if (
        /not found|already|not published|no post|unsupported|cannot unpublish/i.test(
          message
        )
      ) {
        ok.push(platform);
        details.push(`Unpublish ${platform}: ${message} (treated as cleared)`);
        continue;
      }
      details.push(`Failed to unpublish ${platform}: ${message}`);
    }
  }

  return ok;
}

/** DELETE is allowed for any status; must succeed for the post to leave Zernio. */
async function deleteZernioRecord(
  apiKey: string,
  postId: string,
  details: string[],
  attempts = 3
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      await zernioRequest(apiKey, `/posts/${postId}`, { method: "DELETE" });
      details.push("Deleted Zernio record");
      return true;
    } catch (err) {
      if (err instanceof ZernioApiError && err.status === 404) {
        details.push("Zernio record already gone");
        return true;
      }
      const message = errorMessage(err);
      details.push(
        i === attempts - 1
          ? `Failed to delete Zernio record: ${message}`
          : `Delete attempt ${i + 1} failed: ${message}; retrying`
      );
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
    }
  }
  return false;
}

async function deleteOnePost(
  apiKey: string,
  input: NonNullable<BulkDeleteInput["posts"]>[number]
): Promise<DeleteResult | null> {
  const postId = input.postId?.trim();
  if (!postId) return null;

  const details: string[] = [];
  const clearedPlatforms = new Set<string>();

  let fresh: ZernioPost | null = null;
  try {
    fresh = await fetchPost(apiKey, postId);
  } catch (err) {
    details.push(`Load post: ${errorMessage(err)}`);
  }

  if (!fresh && details.length === 0) {
    return { postId, success: true, message: "Already deleted from Zernio" };
  }

  const postStatus = fresh?.status ?? input.status;
  const platforms = fresh?.platforms?.length
    ? fresh.platforms
    : input.platforms ?? [];

  // 1) Remove from social platforms first (DELETE does not remove live platform posts).
  const firstTargets = collectTargets(platforms, postStatus, "attempt");
  if (firstTargets.length > 0) {
    const ok = await unpublishPlatforms(apiKey, postId, firstTargets, details);
    for (const p of ok) clearedPlatforms.add(p);
    await new Promise((r) => setTimeout(r, 300));
  }

  try {
    fresh = await fetchPost(apiKey, postId);
  } catch (err) {
    details.push(`Re-load post: ${errorMessage(err)}`);
  }

  if (fresh) {
    const retryTargets = collectTargets(
      fresh.platforms,
      fresh.status,
      "remaining"
    ).filter((p) => !clearedPlatforms.has(p));
    if (retryTargets.length > 0) {
      details.push(`Retrying unpublish for: ${retryTargets.join(", ")}`);
      const ok = await unpublishPlatforms(apiKey, postId, retryTargets, details);
      for (const p of ok) clearedPlatforms.add(p);
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // 2) Always delete the Zernio record — required for success.
  const deleted = await deleteZernioRecord(apiKey, postId, details);

  if (deleted) {
    // Confirm it's gone
    try {
      const stillThere = await fetchPost(apiKey, postId);
      if (stillThere) {
        details.push("Zernio DELETE returned OK but post still exists; retrying");
        const retryDeleted = await deleteZernioRecord(apiKey, postId, details, 2);
        if (!retryDeleted) {
          return {
            postId,
            success: false,
            message: "Unpublished but Zernio record still exists",
            details,
          };
        }
      }
    } catch (err) {
      details.push(`Verify delete: ${errorMessage(err)}`);
    }

    return {
      postId,
      success: true,
      message: "Deleted from platforms and Zernio",
      details,
    };
  }

  const remainingLive = fresh
    ? collectTargets(fresh.platforms, fresh.status, "remaining").filter(
        (p) => !clearedPlatforms.has(p)
      )
    : [];

  if (remainingLive.length > 0) {
    return {
      postId,
      success: false,
      message: `Could not finish: still live on ${remainingLive.join(", ")}, and Zernio delete failed`,
      details,
    };
  }

  return {
    postId,
    success: false,
    message: "Unpublished from platforms, but Zernio record was not deleted",
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
