import type { NicheProfile } from "@/lib/openai/types";
import { defaultNicheProfile } from "@/lib/openai/types";

export type NichePresetId =
  | "biology"
  | "saas"
  | "fitness"
  | "crypto"
  | "custom";

export type NichePreset = {
  id: NichePresetId;
  label: string;
  description: string;
  niche: NicheProfile;
};

export const NICHE_PRESETS: NichePreset[] = [
  {
    id: "biology",
    label: "Biology / research",
    description: "Lab science, papers, and research communication.",
    niche: {
      ...defaultNicheProfile(),
      topic: "molecular biology and life-science research",
      audience: "graduate students, researchers, and science-curious readers",
      toneNotes: "Precise, curious, and accessible without dumbing down.",
      forbiddenTopics: "Medical advice, diagnoses, unverified miracle cures",
      complianceNotes: "Do not give clinical advice; cite methods carefully.",
    },
  },
  {
    id: "saas",
    label: "SaaS / B2B",
    description: "Product updates, GTM, and founder storytelling.",
    niche: {
      ...defaultNicheProfile(),
      topic: "B2B SaaS and product-led growth",
      audience: "founders, operators, and tech buyers",
      toneNotes: "Clear, practical, and lightly opinionated.",
      forbiddenTopics: "Fake revenue claims, competitor smear",
    },
  },
  {
    id: "fitness",
    label: "Fitness / coaching",
    description: "Training tips, habits, and client motivation.",
    niche: {
      ...defaultNicheProfile(),
      topic: "fitness coaching and sustainable training",
      audience: "busy adults building consistent habits",
      toneNotes: "Encouraging, realistic, no toxic hustle.",
      forbiddenTopics: "Extreme diets, unverified supplements as medicine",
      complianceNotes: "Not medical advice; encourage consulting professionals.",
    },
  },
  {
    id: "crypto",
    label: "Crypto / markets",
    description: "Market notes, on-chain themes, and industry news.",
    niche: {
      ...defaultNicheProfile(),
      topic: "cryptocurrency markets and blockchain industry",
      audience: "retail investors and crypto-native readers",
      toneNotes: "Analytical, cautious about hype, data-aware.",
      forbiddenTopics: "Financial advice, guaranteed returns, pump signals",
      complianceNotes: "Not financial advice; no price predictions as certainty.",
    },
  },
  {
    id: "custom",
    label: "Custom",
    description: "Define your own topic, audience, and tone.",
    niche: defaultNicheProfile(),
  },
];

export function getNichePreset(id: string): NichePreset | undefined {
  return NICHE_PRESETS.find((p) => p.id === id);
}
