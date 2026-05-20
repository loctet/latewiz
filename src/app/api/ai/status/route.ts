import { NextRequest, NextResponse } from "next/server";
import { isOpenAiConfigured, resolveOpenAiApiKey } from "@/lib/openai";

export async function GET(request: NextRequest) {
  const headerKey = request.headers.get("x-openai-api-key");
  const key = resolveOpenAiApiKey(headerKey);
  return NextResponse.json({ openai_configured: isOpenAiConfigured(key) });
}
