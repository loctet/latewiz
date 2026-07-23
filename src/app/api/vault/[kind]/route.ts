import { NextRequest, NextResponse } from "next/server";
import {
  SessionRequiredError,
  requireSessionUserId,
} from "@/lib/server/session";
import { deleteUserSecret, isSecretKind } from "@/lib/server/vault";
import { getVaultStatus } from "@/lib/server/vault";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ kind: string }> }
) {
  try {
    const userId = await requireSessionUserId(request);
    const { kind } = await context.params;
    if (!isSecretKind(kind)) {
      return NextResponse.json(
        { error: "kind must be zernio, openai, or fal" },
        { status: 400 }
      );
    }
    const deleted = await deleteUserSecret(userId, kind);
    const status = await getVaultStatus(userId);
    return NextResponse.json({ ok: deleted, vault: status });
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("DELETE /api/vault/[kind] error:", error);
    return NextResponse.json({ error: "Failed to delete vault key" }, { status: 500 });
  }
}
