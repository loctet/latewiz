/** Minimum characters of research prose before we generate a PDF + See more link. */
export const MIN_PDF_REPORT_CHARS = 4500;

const META_CHAT_RE =
  /que souhaitez-vous|what would you like me to do|je peux notamment|i can (?:also )?help|souhaitez-vous que je|would you like me to|how can i (?:help|assist)|rédiger le rapport complet|write (?:the )?full report for you|voulez-vous que je|let me know if you|teaser\/?\s*$|optimiser le texte pour le seo/i;

const PROMPT_SCAFFOLD_RE =
  /PRIMARY SUBJECT|Research topic \/ brief from the composer|OBJECTIVE RESEARCH MODE|Deep mode:|Workspace niche|Stay on this/i;

/**
 * Strip prompt scaffolding / hashtag-only lines that should never appear in a PDF.
 */
export function cleanResearchReportText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/^#\w+(\s+#\w+)*$/.test(t)) return false;
      if (PROMPT_SCAFFOLD_RE.test(t) && t.length < 220) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** True when the model answered like a chat assistant instead of writing the report. */
export function isConversationalMetaResponse(text: string): boolean {
  const sample = text.slice(0, 2500);
  if (META_CHAT_RE.test(sample)) return true;
  // Lots of "I can…" offer bullets without real analysis sections
  const offerHits = (sample.match(/\b(je peux|i can|i'll|je vais)\b/gi) ?? [])
    .length;
  const hasAnalysisHeading =
    /(?:^|\n)#+\s*(snapshot|executive|market|tokenomics|risk|outlook|analysis|analyse)/i.test(
      text
    );
  return offerHits >= 3 && !hasAnalysisHeading;
}

export type ResearchPdfAssessment = {
  ok: boolean;
  cleaned: string;
  charCount: number;
  reason?: string;
};

/**
 * Decide whether research text is good enough to become a PDF.
 * Requires cleaned length >= MIN_PDF_REPORT_CHARS and no meta/chat fluff.
 */
export function assessResearchForPdf(raw: string): ResearchPdfAssessment {
  const cleaned = cleanResearchReportText(raw);
  const charCount = cleaned.length;

  if (!cleaned.trim()) {
    return {
      ok: false,
      cleaned,
      charCount: 0,
      reason: "Deep research returned empty output",
    };
  }

  if (isConversationalMetaResponse(cleaned)) {
    return {
      ok: false,
      cleaned,
      charCount,
      reason:
        "Deep research returned a chat-style reply instead of a full report — PDF skipped",
    };
  }

  if (charCount < MIN_PDF_REPORT_CHARS) {
    return {
      ok: false,
      cleaned,
      charCount,
      reason: `Deep research report too short for PDF (${charCount} chars; need ≥${MIN_PDF_REPORT_CHARS})`,
    };
  }

  return { ok: true, cleaned, charCount };
}

/** Pull a short display title from a user brief / title hint. */
export function cleanReportTitleHint(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  let t = raw.trim();
  t = t.replace(/^Research topic(?: \/ brief)?(?: from the composer)?:\s*/i, "");
  t = t.replace(/^PRIMARY SUBJECT[^\n]*:\s*/i, "");
  t = t.replace(/\n[\s\S]*$/, "").trim();
  // Drop our instructional wrappers
  if (PROMPT_SCAFFOLD_RE.test(t) && t.length > 80) {
    const m = t.match(/:\s*(.+)$/);
    if (m) t = m[1].trim();
  }
  t = t.replace(/^["']|["']$/g, "").trim();
  if (t.length < 2) return undefined;
  return t.slice(0, 120);
}
