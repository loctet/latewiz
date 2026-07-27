import "server-only";

import { parseJsonFromModelOutput, resolveTextModel } from "@/lib/openai/responses";
import {
  extractHeuristicMetrics,
  structureResearchReportFromText,
  type ResearchReportMetric,
  type StructuredResearchReport,
} from "@/lib/pdf/structure-research-report";
import { renderResearchReportPdf } from "@/lib/pdf/render-research-pdf";
import { saveGeneratedReportPdf } from "@/lib/server/generated-report-files";

async function extractMetricsWithLlm(params: {
  apiKey: string;
  researchReport: string;
}): Promise<ResearchReportMetric[]> {
  try {
    const model = resolveTextModel();
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Extract up to 4 key quantitative metrics from the research report. Return JSON only: {\"metrics\":[{\"label\":\"...\",\"value\":\"...\",\"context\":\"optional\"}]}. Use ONLY numbers/facts present in the report. If none are clear, return {\"metrics\":[]}. Never invent figures.",
          },
          {
            role: "user",
            content: params.researchReport.slice(0, 24_000),
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 400,
      }),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    const parsed = parseJsonFromModelOutput<{
      metrics?: ResearchReportMetric[];
    }>(text);
    const list = Array.isArray(parsed?.metrics) ? parsed!.metrics! : [];
    return list
      .filter(
        (m) =>
          m &&
          typeof m.label === "string" &&
          typeof m.value === "string" &&
          m.label.trim() &&
          m.value.trim()
      )
      .slice(0, 4)
      .map((m) => ({
        label: m.label.trim().slice(0, 40),
        value: m.value.trim().slice(0, 48),
        context: m.context?.trim().slice(0, 80),
      }));
  } catch {
    return [];
  }
}

export async function buildAndPersistResearchPdf(params: {
  apiKey: string;
  userId: string;
  researchReport: string;
  titleHint?: string;
}): Promise<{ absoluteUrl: string; report: StructuredResearchReport } | null> {
  try {
    let metrics = await extractMetricsWithLlm({
      apiKey: params.apiKey,
      researchReport: params.researchReport,
    });
    if (!metrics.length) {
      metrics = extractHeuristicMetrics(params.researchReport);
    }

    const report = structureResearchReportFromText(params.researchReport, {
      titleHint: params.titleHint,
      keyMetrics: metrics,
    });

    const brandName =
      process.env.NEXT_PUBLIC_APP_NAME?.trim() || "LateWiz";
    const pdfBuffer = await renderResearchReportPdf(report, brandName);
    const saved = await saveGeneratedReportPdf({
      userId: params.userId,
      pdfBuffer,
      title: report.title,
    });

    return { absoluteUrl: saved.absoluteUrl, report };
  } catch (err) {
    console.error("buildAndPersistResearchPdf failed:", err);
    return null;
  }
}
