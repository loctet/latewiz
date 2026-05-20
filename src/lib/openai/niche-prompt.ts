import type { NicheProfile } from "./types";
import { defaultNicheProfile } from "./types";

/** ISO 639-1 codes supported in Settings */
export const NICHE_LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "tr", label: "Turkish" },
  { value: "ru", label: "Russian" },
];

export function resolveNicheLanguage(language: string | undefined): string {
  const code = (language ?? "en").trim().toLowerCase() || "en";
  const match = NICHE_LANGUAGE_OPTIONS.find((o) => o.value === code);
  return match ? match.label : code;
}

export function nicheToRecord(niche: NicheProfile): Record<string, string> {
  return {
    language: niche.language,
    topic: niche.topic,
    audience: niche.audience,
    geography: niche.geography,
    tone_notes: niche.toneNotes,
    forbidden_topics: niche.forbiddenTopics,
    compliance_notes: niche.complianceNotes,
    extra_instructions: niche.extraInstructions,
  };
}

export function parseNicheFromBody(body: Record<string, unknown>): NicheProfile {
  const n = (body.niche as Record<string, string>) ?? {};
  const defaults = defaultNicheProfile();
  return {
    language: String(n.language ?? defaults.language),
    topic: String(n.topic ?? defaults.topic),
    audience: String(n.audience ?? defaults.audience),
    geography: String(n.geography ?? defaults.geography),
    toneNotes: String(n.tone_notes ?? n.toneNotes ?? defaults.toneNotes),
    forbiddenTopics: String(
      n.forbidden_topics ?? n.forbiddenTopics ?? defaults.forbiddenTopics
    ),
    complianceNotes: String(
      n.compliance_notes ?? n.complianceNotes ?? defaults.complianceNotes
    ),
    extraInstructions: String(
      n.extra_instructions ?? n.extraInstructions ?? defaults.extraInstructions
    ),
  };
}

/** System-prompt block: language + niche rules for caption/campaign AI */
export function buildNicheSystemInstructions(niche: NicheProfile): string {
  const langLabel = resolveNicheLanguage(niche.language);
  const lines: string[] = [
    `Write ALL user-visible text (titles, bodies, hashtags, labels) in ${langLabel} (${niche.language || "en"}). Do not mix languages unless the niche profile explicitly asks for bilingual content.`,
  ];

  if (niche.topic.trim()) {
    lines.push(`Content niche / topic: ${niche.topic.trim()}`);
  }
  if (niche.audience.trim()) {
    lines.push(`Target audience: ${niche.audience.trim()}`);
  }
  if (niche.geography.trim()) {
    lines.push(`Geography / market: ${niche.geography.trim()}`);
  }
  if (niche.toneNotes.trim()) {
    lines.push(`Tone & voice: ${niche.toneNotes.trim()}`);
  }
  if (niche.forbiddenTopics.trim()) {
    lines.push(`Never mention or promote: ${niche.forbiddenTopics.trim()}`);
  }
  if (niche.complianceNotes.trim()) {
    lines.push(`Compliance & legal: ${niche.complianceNotes.trim()}`);
  }
  if (niche.extraInstructions.trim()) {
    lines.push(`Additional instructions: ${niche.extraInstructions.trim()}`);
  }

  return lines.join("\n");
}

/** User-message appendix with full niche JSON for structured context */
export function buildNicheUserContext(niche: NicheProfile): string {
  return `Workspace niche profile (follow strictly):\n${JSON.stringify(nicheToRecord(niche), null, 2)}`;
}

/** Image prompt appendix: language for on-image text */
export function buildNicheImageLanguageNote(niche: NicheProfile): string {
  const langLabel = resolveNicheLanguage(niche.language);
  return `All handwritten text, titles, labels, and table headers on the infographic must be in ${langLabel}.`;
}
