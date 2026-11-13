import { NextRequest, NextResponse } from "next/server";
import type { ExplainerJobStatus } from "@/lib/render-jobs";
import {
  getRenderJobForUser,
  isRenderWorkerOnline,
} from "@/lib/server/render-jobs";
import {
  SessionRequiredError,
  requireSessionUserId,
} from "@/lib/server/session";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireSessionUserId(request);
    const { id } = await context.params;
    const job = id?.trim() ? await getRenderJobForUser(userId, id.trim()) : null;
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const payload: ExplainerJobStatus = {
      id: job.id,
      status: job.status,
      video_url:
        job.status === "done" && job.mediaId
          ? `/api/media/generated/file/${encodeURIComponent(job.mediaId)}`
          : null,
      error: job.status === "failed" ? job.error ?? "Render failed" : null,
      worker_online:
        job.status === "done" || job.status === "failed"
          ? true
          : await isRenderWorkerOnline(),
      age_seconds: Math.max(
        0,
        Math.round((Date.now() - new Date(job.createdAt).getTime()) / 1000)
      ),
    };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("GET /api/ai/explainer/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to load explainer status" },
      { status: 500 }
    );
  }
}
