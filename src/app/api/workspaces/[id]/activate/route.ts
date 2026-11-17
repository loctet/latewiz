import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/server/session";
import { activateWorkspace } from "@/lib/server/workspaces";
import { serializeWorkspace, workspaceErrorResponse } from "../../_shared";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireSessionUserId(request);
    const { id } = await context.params;
    const active = await activateWorkspace(userId, id);
    return NextResponse.json({ workspace: await serializeWorkspace(active) });
  } catch (error) {
    return workspaceErrorResponse(error, "Failed to switch workspace");
  }
}
