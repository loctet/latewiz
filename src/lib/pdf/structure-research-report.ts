export type ResearchReportMetric = {
  label: string;
  value: string;
  context?: string;
};

export type ResearchReportBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | {
      type: "table";
      headers: string[];
      rows: string[][];
    };

export type ResearchReportSection = {
  heading: string;
  blocks: ResearchReportBlock[];
};

export type StructuredResearchReport = {
  title: string;
  subtitle?: string;
  generatedAt: string;
  keyMetrics: ResearchReportMetric[];
  sections: ResearchReportSection[];
  disclaimer?: string;
};

function stripMdInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s*/, "")
    .trim();
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(line.trim());
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => stripMdInline(c.trim()));
}

function parseTable(
  lines: string[],
  start: number
): { table: Extract<ResearchReportBlock, { type: "table" }>; next: number } | null {
  if (start + 1 >= lines.length) return null;
  const headerLine = lines[start];
  const sepLine = lines[start + 1];
  if (!headerLine.includes("|") || !isTableSeparator(sepLine)) return null;

  const headers = splitTableRow(headerLine);
  const rows: string[][] = [];
  let i = start + 2;
  while (i < lines.length && lines[i].includes("|") && !lines[i].match(/^#{1,3}\s/)) {
    if (isTableSeparator(lines[i])) {
      i += 1;
      continue;
    }
    const cells = splitTableRow(lines[i]);
    if (cells.some((c) => c.length > 0)) {
      rows.push(cells);
    }
    i += 1;
  }
  if (!headers.length || !rows.length) return null;
  return { table: { type: "table", headers, rows }, next: i };
}

function looksLikeHeading(line: string): boolean {
  if (/^#{1,3}\s+\S/.test(line)) return true;
  // All-caps headings — but not prompt scaffolding
  if (
    /^[A-ZÀ-Ÿ][A-ZÀ-Ÿ0-9 &/,\-]{8,80}$/.test(line.trim()) &&
    !/PRIMARY SUBJECT|RESEARCH TOPIC|COMPOSER/i.test(line)
  ) {
    return true;
  }
  if (
    /^(SNAPSHOT|EXECUTIVE|CORE |COMPARATIVE|TOKENOMICS|TECHNICAL|STRATEGIC|DISCLAIMER|OUTLOOK|SUMMARY|MARKET|RISK|OVERVIEW|INTRODUCTION|CONCLUSION)/i.test(
      line.trim()
    ) &&
    line.trim().length < 90
  ) {
    return true;
  }
  return false;
}

function headingText(line: string): string {
  return stripMdInline(line.replace(/^#{1,3}\s+/, ""));
}

/**
 * Parse deep-research markdown/prose into a structured PDF document model.
 * Does not invent metrics — callers may merge LLM-extracted KPIs separately.
 */
export function structureResearchReportFromText(
  raw: string,
  options?: { titleHint?: string; keyMetrics?: ResearchReportMetric[] }
): StructuredResearchReport {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const lines = text.split("\n");

  let title =
    options?.titleHint?.trim() ||
    "Deep Research Report";
  let subtitle: string | undefined;

  // Prefer first markdown H1 as title
  const h1 = lines.find((l) => /^#\s+\S/.test(l.trim()));
  if (h1) {
    title = headingText(h1);
  }

  const sections: ResearchReportSection[] = [];
  let current: ResearchReportSection | null = null;
  let paragraphBuf: string[] = [];
  let bulletBuf: string[] = [];
  let disclaimer: string | undefined;

  const flushParagraph = () => {
    if (!paragraphBuf.length || !current) return;
    const joined = paragraphBuf.join(" ").replace(/\s+/g, " ").trim();
    paragraphBuf = [];
    if (joined) current.blocks.push({ type: "paragraph", text: joined });
  };

  const flushBullets = () => {
    if (!bulletBuf.length || !current) return;
    current.blocks.push({ type: "bullets", items: [...bulletBuf] });
    bulletBuf = [];
  };

  const ensureSection = (heading: string) => {
    flushBullets();
    flushParagraph();
    current = { heading, blocks: [] };
    sections.push(current);
  };

  let i = 0;
  // Skip leading title line if used as H1
  if (h1) {
    const idx = lines.findIndex((l) => l === h1);
    if (idx === 0) i = 1;
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushBullets();
      flushParagraph();
      i += 1;
      continue;
    }

    const table = parseTable(lines, i);
    if (table) {
      flushBullets();
      flushParagraph();
      if (!current) ensureSection("Overview");
      current!.blocks.push(table.table);
      i = table.next;
      continue;
    }

    if (looksLikeHeading(trimmed)) {
      const heading = headingText(trimmed);
      if (/disclaimer/i.test(heading)) {
        flushBullets();
        flushParagraph();
        // Collect following paragraph as disclaimer
        i += 1;
        const discParts: string[] = [];
        while (i < lines.length && lines[i].trim() && !looksLikeHeading(lines[i].trim())) {
          discParts.push(stripMdInline(lines[i].trim()));
          i += 1;
        }
        disclaimer = discParts.join(" ").trim() || undefined;
        continue;
      }
      ensureSection(heading);
      i += 1;
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      flushParagraph();
      if (!current) ensureSection("Key points");
      bulletBuf.push(
        stripMdInline(trimmed.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, ""))
      );
      i += 1;
      continue;
    }

    if (!current) {
      // Opening blurb before first heading → subtitle or overview
      if (!subtitle && trimmed.length < 180) {
        subtitle = stripMdInline(trimmed);
        i += 1;
        continue;
      }
      ensureSection("Overview");
    }

    paragraphBuf.push(stripMdInline(trimmed));
    i += 1;
  }

  flushBullets();
  flushParagraph();

  if (!sections.length) {
    sections.push({
      heading: "Report",
      blocks: [
        {
          type: "paragraph",
          text: stripMdInline(text.slice(0, 12_000)) || "No content.",
        },
      ],
    });
  }

  return {
    title,
    subtitle,
    generatedAt: new Date().toISOString(),
    keyMetrics: options?.keyMetrics?.filter((m) => m.label && m.value) ?? [],
    sections,
    disclaimer:
      disclaimer ||
      "This report is for informational purposes only and does not constitute investment advice. Do your own research.",
  };
}

/** Heuristic metrics from bold “Label: value” lines when no LLM extraction. */
export function extractHeuristicMetrics(
  raw: string,
  limit = 4
): ResearchReportMetric[] {
  const metrics: ResearchReportMetric[] = [];
  const seen = new Set<string>();
  const patterns = [
    /\*\*([^*]{2,40})\*\*[:\s]+([^\n]{2,48})/g,
    /^([A-Z][A-Za-z0-9 %/$]{2,36}):\s*([^\n]{2,48})$/gm,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null && metrics.length < limit) {
      const label = m[1].trim();
      const value = m[2].trim().replace(/\*\*/g, "").slice(0, 48);
      const key = label.toLowerCase();
      if (seen.has(key) || value.length < 2) continue;
      // Prefer lines that look quantitative
      if (!/[\d%$]|bn|m\b|x\b|high|low|up|down/i.test(value) && !/[\d%]/.test(label)) {
        continue;
      }
      seen.add(key);
      metrics.push({ label, value });
    }
  }
  return metrics;
}
