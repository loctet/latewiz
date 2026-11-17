import { NextResponse } from "next/server";
import { SessionRequiredError } from "@/lib/server/session";
import { VaultConfigError, getVaultStatus } from "@/lib/server/vault";
import { WorkspaceError, type WorkspaceRecord } from "@/lib/server/workspaces";

export async function serializeWorkspace(w: WorkspaceRecord) {
  const vault = await getVaultStatus(w.userId, w.id);
  return {
    id: w.id,
    name: w.name,
    isActive: w.isActive,
    topic: w.niche.topic,
    language: w.niche.language,
    zernioHint: vault.zernioHint,
    hasOpenai: vault.hasOpenai,
    hasFal: vault.hasFal,
    createdAt: w.createdAt.toISOString(),
  };
}

export function workspaceErrorResponse(error: unknown, fallback: string) {
  if (error instanceof SessionRequiredError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof WorkspaceError || error instanceof VaultConfigError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
