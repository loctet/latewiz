import { NextRequest } from "next/server";
import { resolveUserOpenAiKey } from "@/lib/openai/resolve-key";
import { resolveUserFalKey } from "@/lib/fal/resolve-key";
import { resolveUserZernioKey } from "@/lib/server/resolve-user-keys";
import {
  SessionRequiredError,
  getSessionFromRequest,
} from "@/lib/server/session";

export async function requireUserAiKeys(
  request: NextRequest,
  body?: Record<string, unknown>
): Promise<{
  userId: string;
  openaiApiKey: string | null;
  falApiKey: string | null;
}> {
  const session = await getSessionFromRequest(request);
  if (!session?.user?.id) {
    throw new SessionRequiredError();
  }
  const userId = session.user.id;
  const openaiApiKey = await resolveUserOpenAiKey(
    userId,
    request.headers.get("x-openai-api-key"),
    typeof body?.openaiApiKey === "string" ? body.openaiApiKey : null
  );
  const falApiKey = await resolveUserFalKey(
    userId,
    request.headers.get("x-fal-api-key"),
    typeof body?.falApiKey === "string" ? body.falApiKey : null
  );
  return { userId, openaiApiKey, falApiKey };
}

export async function requireUserZernioKey(
  request: NextRequest
): Promise<{ userId: string; zernioApiKey: string }> {
  const session = await getSessionFromRequest(request);
  if (!session?.user?.id) {
    throw new SessionRequiredError();
  }
  const headerKey =
    request.headers.get("x-zernio-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
  const zernioApiKey = await resolveUserZernioKey(session.user.id, headerKey);
  if (!zernioApiKey) {
    throw new Error(
      "Zernio API key not found. Add your key in Settings or complete onboarding."
    );
  }
  return { userId: session.user.id, zernioApiKey };
}
