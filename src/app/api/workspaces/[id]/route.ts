import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/server/session";
import { deleteWorkspace, renameWorkspace } from "@/lib/server/workspaces";
import { serializeWorkspace, workspaceErrorResponse } from "../_shared";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    const updated = await renameWorkspace(userId, id, String(body.name ?? ""));
    return NextResponse.json({ workspace: await serializeWorkspace(updated) });
  } catch (error) {
    return workspaceErrorResponse(error, "Failed to rename workspace");
  }
}

/** Deletes the workspace, its stored keys and its scheduled campaigns. */
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { id } = await context.params;
    await deleteWorkspace(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return workspaceErrorResponse(error, "Failed to delete workspace");
  }
}
