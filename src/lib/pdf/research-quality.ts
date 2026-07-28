/** Minimum characters of research prose before we generate a PDF + See more link. */
export const MIN_PDF_REPORT_CHARS = 4500;

const META_CHAT_RE =
  /que souhaitez-vous|what would you like me to do|je peux notamment|i can (?:also )?help|souhaitez-vous que je|would you like me to|how can i (?:help|assist)|rédiger le rapport complet|write (?:the )?full report for you|voulez-vous que je|let me know if you|teaser\/?\s*$|optimiser le texte pour le seo/i;

const REFUSAL_OR_META_TOPIC_RE =
  /je suis désolé.*ne (?:peux|peut) pas|i(?:['’]m| am) sorry.*(?:can(?:['’]t| not)|unable)|cannot (?:respond|comply|help)|je ne peux pas répondre|formule de refus|formulation d['’]un refus|analyse de la formulation|as a refusal formula|refus en communication|politesse.*efficacité|i cannot fulfill/i;

const PROMPT_SCAFFOLD_RE =
  /PRIMARY SUBJECT|Research topic \/ brief from the composer|OBJECTIVE RESEARCH MODE|Deep mode:|Workspace niche|Stay on this|Tone:\s*/i;

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "de",
  "la",
  "le",
  "les",
  "une",
  "un",
  "des",
  "du",
  "et",
  "en",
  "sur",
  "tone",
  "professional",
  "casual",
  "witty",
  "educational",
  "topic",
  "brief",
  "research",
  "market",
  "analysis",
  "analyse",
]);

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
  const offerHits = (sample.match(/\b(je peux|i can|i'll|je vais)\b/gi) ?? [])
    .length;
  const hasAnalysisHeading =
    /(?:^|\n)#+\s*(snapshot|executive|market|tokenomics|risk|outlook|analysis|analyse)/i.test(
      text
    );
  return offerHits >= 3 && !hasAnalysisHeading;
}

/** True when output is an AI refusal or an essay ABOUT a refusal (subject drift). */
export function isRefusalOrRefusalEssay(text: string): boolean {
  return REFUSAL_OR_META_TOPIC_RE.test(text.slice(0, 4000));
}

/** Meaningful tokens from the user subject for on-topic checks. */
export function extractSubjectTokens(subject: string): string[] {
  return subject
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * Report must mention the user's subject. Prevents PDFs about unrelated themes
 * (e.g. analyzing an AI refusal when the user asked for Union U crypto).
 */
export function reportMatchesSubject(
  report: string,
  subject?: string | null
): boolean {
  const cleanedSubject = cleanReportTitleHint(subject) || subject?.trim();
  if (!cleanedSubject) return true;

  const hay = report.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const needle = cleanedSubject
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  if (hay.includes(needle)) return true;

  const tokens = extractSubjectTokens(cleanedSubject);
  if (!tokens.length) return true;

  const hits = tokens.filter((t) => hay.includes(t));
  // Need most distinctive tokens present (at least 1 if only one; else ≥2 or all)
  if (tokens.length === 1) return hits.length === 1;
  if (tokens.length === 2) return hits.length === 2;
  return hits.length >= Math.ceil(tokens.length * 0.6);
}

export type ResearchPdfAssessment = {
  ok: boolean;
  cleaned: string;
  charCount: number;
  reason?: string;
};

/**
 * Decide whether research text is good enough to become a PDF.
 * Requires cleaned length ≥ MIN_PDF_REPORT_CHARS, no meta/chat fluff,
 * and alignment with the requested subject when provided.
 */
export function assessResearchForPdf(
  raw: string,
  expectedSubject?: string | null
): ResearchPdfAssessment {
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

  if (isRefusalOrRefusalEssay(cleaned)) {
    return {
      ok: false,
      cleaned,
      charCount,
      reason:
        "Deep research returned a refusal / meta reply instead of researching your topic — PDF skipped",
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

  if (expectedSubject && !reportMatchesSubject(cleaned, expectedSubject)) {
    return {
      ok: false,
      cleaned,
      charCount,
      reason: `Deep research output is off-topic (expected “${cleanReportTitleHint(expectedSubject) || expectedSubject.slice(0, 60)}”) — PDF skipped`,
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
  // Drop tone lines from AI Studio payload
  t = t
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^Tone:\s*/i.test(l) && !PROMPT_SCAFFOLD_RE.test(l))
    .join(" ")
    .trim();
  if (PROMPT_SCAFFOLD_RE.test(t) && t.length > 80) {
    const m = t.match(/:\s*(.+)$/);
    if (m) t = m[1].trim();
  }
  t = t.replace(/^["']|["']$/g, "").trim();
  if (t.length < 2) return undefined;
  return t.slice(0, 120);
}

/** Build a tight research brief from the user subject (not the full niche prompt). */
export function buildDeepResearchBrief(params: {
  subject: string;
  postTemplateLabel?: string;
}): string {
  const subject = cleanReportTitleHint(params.subject) || params.subject.trim();
  return [
    `PRIMARY RESEARCH SUBJECT (mandatory — research ONLY this): ${subject}`,
    params.postTemplateLabel
      ? `Report style: ${params.postTemplateLabel} (institutional analysis of the subject above).`
      : "Report style: institutional research analysis.",
    "Write the FULL report now (≥4500 characters, markdown ## headings, tables if useful).",
    "Do not ask questions. Do not refuse by writing about refusal language. Do not change the subject.",
  ].join("\n");
}
