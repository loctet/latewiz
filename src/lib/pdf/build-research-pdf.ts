import "server-only";

import { parseJsonFromModelOutput, resolveTextModel } from "@/lib/openai/responses";
import {
  extractHeuristicMetrics,
  structureResearchReportFromText,
  type ResearchReportMetric,
  type StructuredResearchReport,
} from "@/lib/pdf/structure-research-report";
import {
  assessResearchForPdf,
  cleanReportTitleHint,
  cleanResearchReportText,
  isConversationalMetaResponse,
  MIN_PDF_REPORT_CHARS,
} from "@/lib/pdf/research-quality";
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

/**
 * When deep research returns usable notes that are under the PDF floor,
 * expand them into a full institutional report (≥ MIN_PDF_REPORT_CHARS).
 */
async function expandToFullReport(params: {
  apiKey: string;
  researchNotes: string;
  titleHint?: string;
}): Promise<string | null> {
  try {
    const model = resolveTextModel();
    const subject = cleanReportTitleHint(params.titleHint) || "the subject";
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
            content: [
              "You turn research notes into a COMPLETE institutional PDF report.",
              `Write at least ${MIN_PDF_REPORT_CHARS} characters.`,
              "Use markdown ## section headings and tables where useful.",
              "Stay factual — only use claims supported by the notes; if thin, say evidence is limited.",
              "Do NOT ask questions, offer options, write hashtags, or write a social teaser.",
              "Output the report body only.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              `Subject: ${subject}`,
              "",
              "=== RESEARCH NOTES ===",
              params.researchNotes.slice(0, 40_000),
              "=== END NOTES ===",
              "",
              "Write the full institutional report now.",
            ].join("\n"),
          },
        ],
        max_tokens: 8192,
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = cleanResearchReportText(
      body.choices?.[0]?.message?.content ?? ""
    );
    if (!text || isConversationalMetaResponse(text)) return null;
    if (text.length < MIN_PDF_REPORT_CHARS) return null;
    return text;
  } catch {
    return null;
  }
}

export async function buildAndPersistResearchPdf(params: {
  apiKey: string;
  userId: string;
  researchReport: string;
  titleHint?: string;
  publicOrigin?: string | null;
}): Promise<{
  absoluteUrl: string;
  report: StructuredResearchReport;
  skippedReason?: string;
} | null> {
  try {
    let assessment = assessResearchForPdf(params.researchReport);

    // Expand short-but-usable notes into a full report before giving up
    if (
      !assessment.ok &&
      assessment.cleaned.length >= 400 &&
      !isConversationalMetaResponse(assessment.cleaned) &&
      assessment.charCount < MIN_PDF_REPORT_CHARS
    ) {
      const expanded = await expandToFullReport({
        apiKey: params.apiKey,
        researchNotes: assessment.cleaned,
        titleHint: params.titleHint,
      });
      if (expanded) {
        assessment = assessResearchForPdf(expanded);
      }
    }

    if (!assessment.ok) {
      console.warn(
        "[pdf] skipping PDF:",
        assessment.reason,
        `(chars=${assessment.charCount})`
      );
      return null;
    }

    let metrics = await extractMetricsWithLlm({
      apiKey: params.apiKey,
      researchReport: assessment.cleaned,
    });
    if (!metrics.length) {
      metrics = extractHeuristicMetrics(assessment.cleaned);
    }

    const titleHint = cleanReportTitleHint(params.titleHint);
    const report = structureResearchReportFromText(assessment.cleaned, {
      titleHint,
      keyMetrics: metrics,
    });

    // Never allow scaffold text as the cover title
    if (
      /PRIMARY SUBJECT|Research topic \/ brief|composer/i.test(report.title)
    ) {
      report.title = titleHint || "Deep Research Report";
    }

    const brandName =
      process.env.NEXT_PUBLIC_APP_NAME?.trim() || "LateWiz";
    const pdfBuffer = await renderResearchReportPdf(report, brandName);
    const saved = await saveGeneratedReportPdf({
      userId: params.userId,
      pdfBuffer,
      title: report.title,
      publicOrigin: params.publicOrigin,
    });

    return { absoluteUrl: saved.absoluteUrl, report };
  } catch (err) {
    console.error("buildAndPersistResearchPdf failed:", err);
    return null;
  }
}
