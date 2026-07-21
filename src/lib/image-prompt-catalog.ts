import type { NicheProfile } from "@/lib/openai/types";
import { buildNicheImageLanguageNote } from "@/lib/openai/niche-prompt";
import { foldAccentsForImagePrompt } from "@/lib/openai/sanitize-post-text";

export const DEFAULT_IMAGE_PROMPT_STYLE_ID = "notebook-educational";

/** Placeholders you can use in custom templates (Settings → Image prompts). */
export const IMAGE_PROMPT_TEMPLATE_HELP =
  "Use {{langNote}} for language rules and {{subject}} for post topic / caption context.";

export type ImagePromptStyle = {
  id: string;
  label: string;
  description: string;
  template: string;
};

/** User-created styles (metadata only; template text lives in imagePromptTemplates). */
export type CustomImagePromptStyle = Pick<
  ImagePromptStyle,
  "id" | "label" | "description"
>;

export const CUSTOM_IMAGE_PROMPT_TEMPLATE_STARTER = `Create a social media image.

{{langNote}}

Topic:
{{subject}}

Style: describe your visual style, layout, colors, and mood here.`;

export function isBuiltinImagePromptStyle(styleId: string): boolean {
  return IMAGE_PROMPT_STYLES.some((s) => s.id === styleId);
}

export function createCustomImagePromptStyleId(
  label: string,
  existingIds: Iterable<string>
): string {
  const taken = new Set(existingIds);
  const slug =
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "template";
  let id = `custom-${slug}`;
  let n = 2;
  while (taken.has(id)) {
    id = `custom-${slug}-${n}`;
    n += 1;
  }
  return id;
}

export function getAllImagePromptStyles(
  custom: CustomImagePromptStyle[] = []
): ImagePromptStyle[] {
  const customStyles: ImagePromptStyle[] = custom.map((style) => ({
    ...style,
    template: CUSTOM_IMAGE_PROMPT_TEMPLATE_STARTER,
  }));
  return [...IMAGE_PROMPT_STYLES, ...customStyles];
}

export const IMAGE_PROMPT_STYLES: ImagePromptStyle[] = [
  {
    id: DEFAULT_IMAGE_PROMPT_STYLE_ID,
    label: "Notebook infographic",
    description:
      "Hand-drawn blue pen sketch on notebook paper — educational comparison board (default).",
    template: `Create a hand drawn educational infographic on notebook paper using blue ballpoint pen sketch style.

{{langNote}}

The infographic should compare and explain this topic in depth:

{{subject}}

Style requirements:

• realistic notebook page background
• hand drawn doodles and sketches
• blue ink only
• clean handwritten typography
• simple but intelligent visual explanations
• tables, arrows, icons, charts, and mini diagrams
• visually balanced composition
• viral educational social media aesthetic
• looks like carefully drawn by a smart student or teacher
• slightly imperfect pen strokes for authenticity
• highly engaging and easy to understand
• include comparison boxes and visual storytelling
• minimalist but information dense
• infographic poster layout
• portrait composition
• neat margins and aligned sections

Structure: large handwritten title at top, main illustrations in center, comparison table, small diagrams at bottom, conclusion sentence.

Rendering: ultra sharp focus, even lighting, full notebook page visible, portrait-oriented.

Final detail: tiny neat handwritten credit in bottom margin: KWEZIX.com`,
  },
  {
    id: "minimal-quote-card",
    label: "Quote card",
    description: "Clean social card with bold headline and short supporting text.",
    template: `Design a premium social media quote card image.

{{langNote}}

Content to visualize:
{{subject}}

Style: minimal layout, soft gradient or solid background, large bold headline, one short supporting line, plenty of whitespace, modern sans-serif typography, Instagram-ready 4:5 portrait, no clutter, no stock photo borders, high contrast readable text.`,
  },
  {
    id: "flat-vector-infographic",
    label: "Flat vector infographic",
    description: "Colorful modern flat design with icons and clear sections.",
    template: `Create a modern flat vector infographic for social media.

{{langNote}}

Topic:
{{subject}}

Style: bright but professional color palette, simple geometric icons, 3–5 labeled sections, arrows and connectors, clean grid layout, no photorealism, vector illustration look, portrait poster format, shareable educational aesthetic.`,
  },
  {
    id: "photo-realistic",
    label: "Photo realistic",
    description: "Cinematic photograph that illustrates the post topic.",
    template: `Create a photorealistic social media image.

{{langNote}}

Scene should illustrate:
{{subject}}

Style: natural lighting, shallow depth of field, authentic lifestyle or workplace context, no text overlays, no watermarks, aspirational but believable, vertical 4:5 crop suitable for Instagram feed.`,
  },
  {
    id: "carousel-slide",
    label: "Carousel slide",
    description: "Single carousel slide with title and three bullet points.",
    template: `Design one Instagram carousel slide (portrait).

{{langNote}}

Content:
{{subject}}

Layout: bold title at top, exactly three short bullet points with icons, brand-neutral modern design, high readability on mobile, consistent padding, subtle background pattern, no more than 40 words of text on image.`,
  },
  {
    id: "dark-tech",
    label: "Dark tech",
    description: "Dark UI aesthetic with neon accents — SaaS and dev content.",
    template: `Create a dark-mode tech social graphic.

{{langNote}}

Concept:
{{subject}}

Style: deep charcoal background, subtle grid or glow, neon blue or purple accents, abstract UI elements or code hints, futuristic but clean, portrait format, crisp typography, no cluttered screenshots.`,
  },
  {
    id: "watercolor",
    label: "Watercolor illustration",
    description: "Soft artistic watercolor scene related to the topic.",
    template: `Paint a watercolor illustration for a social post.

{{langNote}}

Subject:
{{subject}}

Style: soft washes, paper texture, gentle edges, artistic not childish, limited text (title only if needed), dreamy cohesive palette, portrait composition, gallery-quality illustration.`,
  },
  {
    id: "data-dashboard",
    label: "Data dashboard",
    description: "Analytics-style visual with charts and KPI-style metrics.",
    template: `Create a data-dashboard style social graphic.

{{langNote}}

Message to convey:
{{subject}}

Style: clean dashboard mockup, 2–3 simple charts (bar, line, or donut), fictional but realistic metrics, light UI chrome, professional B2B look, portrait layout, readable labels, no real brand logos.`,
  },
  {
    id: "product-hero",
    label: "Product hero",
    description: "Marketing hero shot — spotlight on a concept or offer.",
    template: `Create a product-style hero marketing image.

{{langNote}}

Offer or concept:
{{subject}}

Style: studio lighting, centered hero object or abstract product stand-in, premium e-commerce aesthetic, soft shadow, minimal props, space for implied headline, portrait 4:5, no busy background.`,
  },
  {
    id: "motivational-poster",
    label: "Motivational poster",
    description: "Bold inspirational poster with striking background.",
    template: `Design a motivational social media poster.

{{langNote}}

Theme:
{{subject}}

Style: dramatic sky or landscape background, strong central message area, bold condensed typography, high energy, portrait orientation, inspirational Instagram/TikTok aesthetic, text legible on mobile.`,
  },
  {
    id: "comic-panel",
    label: "Comic panel",
    description: "Single comic strip panel — friendly and shareable.",
    template: `Draw a single-panel comic for social media.

{{langNote}}

Story idea:
{{subject}}

Style: clean line art, light cel shading, expressive simple characters, speech bubble with short dialogue, humorous or relatable tone, portrait panel, readable on small screens.`,
  },
  {
    id: "checklist-visual",
    label: "Checklist visual",
    description: "Numbered tips or steps with checkmarks — how-to posts.",
    template: `Create a checklist-style educational social image.

{{langNote}}

Content:
{{subject}}

Style: numbered list 1–5 with checkmark icons, clear hierarchy, friendly colors, notepad or sticky-note motif optional, portrait layout, scannable in 2 seconds, professional tips aesthetic.`,
  },
];

export function getImagePromptStyle(
  id?: string | null,
  custom: CustomImagePromptStyle[] = []
): ImagePromptStyle {
  const found = getAllImagePromptStyles(custom).find((s) => s.id === id);
  return found ?? IMAGE_PROMPT_STYLES[0];
}

export function getDefaultTemplate(
  styleId: string,
  custom: CustomImagePromptStyle[] = []
): string {
  if (isBuiltinImagePromptStyle(styleId)) {
    return getImagePromptStyle(styleId, custom).template;
  }
  return CUSTOM_IMAGE_PROMPT_TEMPLATE_STARTER;
}

export function getEffectiveTemplate(
  styleId: string,
  overrides?: Record<string, string>,
  custom: CustomImagePromptStyle[] = []
): string {
  const override = overrides?.[styleId]?.trim();
  if (override) return override;
  return getDefaultTemplate(styleId, custom);
}

export function applyImagePromptTemplate(
  template: string,
  subject: string,
  langNote: string
): string {
  return template
    .replaceAll("{{langNote}}", langNote)
    .replaceAll("{{subject}}", subject.trim())
    .slice(0, 4000);
}

export function buildImagePromptFromStyle(
  styleId: string | undefined,
  subject: string,
  niche: NicheProfile,
  templateOverrides?: Record<string, string>,
  customStyles: CustomImagePromptStyle[] = []
): string {
  const id = styleId || DEFAULT_IMAGE_PROMPT_STYLE_ID;
  const template = getEffectiveTemplate(id, templateOverrides, customStyles);
  const langNote = buildNicheImageLanguageNote(niche);
  const safeSubject = foldAccentsForImagePrompt(subject);
  return applyImagePromptTemplate(template, safeSubject, langNote);
}
