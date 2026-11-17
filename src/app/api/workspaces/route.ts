import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/server/session";
import { upsertUserSecret } from "@/lib/server/vault";
import { isPlausibleZernioKey } from "@/lib/server/resolve-user-keys";
import {
  WorkspaceError,
  activateWorkspace,
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
} from "@/lib/server/workspaces";
import { serializeWorkspace, workspaceErrorResponse } from "./_shared";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const all = await listWorkspaces(userId);
    return NextResponse.json({
      workspaces: await Promise.all(all.map(serializeWorkspace)),
    });
  } catch (error) {
    return workspaceErrorResponse(error, "Failed to list workspaces");
  }
}

/**
 * Create a workspace, usually by duplicating one (`sourceId`) and swapping its
 * Zernio key. Body: { name, sourceId?, zernioKey?, activate? }.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      sourceId?: string | null;
      zernioKey?: string;
      activate?: boolean;
    };

    const zernioKey = body.zernioKey?.trim();
    if (zernioKey && !isPlausibleZernioKey(zernioKey)) {
      throw new WorkspaceError("Invalid Zernio API key (expected sk_…)");
    }

    const created = await createWorkspace(userId, {
      name: String(body.name ?? ""),
      sourceId: body.sourceId ?? null,
    });
    try {
      if (zernioKey) {
        await upsertUserSecret(userId, "zernio", zernioKey, created.id);
      }
    } catch (error) {
      await deleteWorkspace(userId, created.id).catch(() => {});
      throw error;
    }

    const result = body.activate
      ? await activateWorkspace(userId, created.id)
      : created;
    return NextResponse.json({ workspace: await serializeWorkspace(result) });
  } catch (error) {
    return workspaceErrorResponse(error, "Failed to create workspace");
  }
}
