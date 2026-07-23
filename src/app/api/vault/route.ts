import { NextRequest, NextResponse } from "next/server";
import { isPlausibleOpenAiApiKey } from "@/lib/openai/resolve-key";
import { isPlausibleFalApiKey } from "@/lib/fal/resolve-key";
import {
  SessionRequiredError,
  requireSessionUserId,
} from "@/lib/server/session";
import {
  deleteUserSecret,
  getVaultStatus,
  isSecretKind,
  upsertUserSecret,
  VaultConfigError,
} from "@/lib/server/vault";
import type { SecretKind } from "@/db/schema";

function isPlausibleZernioKey(key: string): boolean {
  const trimmed = key.trim();
  return trimmed.startsWith("sk_") && trimmed.length >= 16;
}

function validateSecret(kind: SecretKind, value: string): string | null {
  const trimmed = value.trim();
  if (kind === "zernio" && !isPlausibleZernioKey(trimmed)) {
    return "Invalid Zernio API key (expected sk_…)";
  }
  if (kind === "openai" && !isPlausibleOpenAiApiKey(trimmed)) {
    return "Invalid OpenAI API key";
  }
  if (kind === "fal" && !isPlausibleFalApiKey(trimmed)) {
    return "Invalid fal API key";
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const status = await getVaultStatus(userId);
    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof VaultConfigError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("GET /api/vault error:", error);
    return NextResponse.json({ error: "Failed to load vault" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const body = (await request.json()) as {
      zernio?: string;
      openai?: string;
      fal?: string;
    };

    const updates: Array<{ kind: SecretKind; value: string }> = [];
    if (typeof body.zernio === "string" && body.zernio.trim()) {
      updates.push({ kind: "zernio", value: body.zernio });
    }
    if (typeof body.openai === "string" && body.openai.trim()) {
      updates.push({ kind: "openai", value: body.openai });
    }
    if (typeof body.fal === "string" && body.fal.trim()) {
      updates.push({ kind: "fal", value: body.fal });
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one key to save (zernio, openai, fal)" },
        { status: 400 }
      );
    }

    for (const update of updates) {
      const invalid = validateSecret(update.kind, update.value);
      if (invalid) {
        return NextResponse.json({ error: invalid }, { status: 400 });
      }
    }

    for (const update of updates) {
      await upsertUserSecret(userId, update.kind, update.value);
    }

    const status = await getVaultStatus(userId);
    return NextResponse.json({ ok: true, vault: status });
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof VaultConfigError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("PUT /api/vault error:", error);
    return NextResponse.json({ error: "Failed to save vault keys" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const kindParam =
      request.nextUrl.searchParams.get("kind") ??
      request.nextUrl.pathname.split("/").pop();

    if (!kindParam || !isSecretKind(kindParam)) {
      return NextResponse.json(
        { error: "kind must be zernio, openai, or fal" },
        { status: 400 }
      );
    }

    const deleted = await deleteUserSecret(userId, kindParam);
    const status = await getVaultStatus(userId);
    return NextResponse.json({ ok: deleted, vault: status });
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof VaultConfigError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("DELETE /api/vault error:", error);
    return NextResponse.json({ error: "Failed to delete vault key" }, { status: 500 });
  }
}
