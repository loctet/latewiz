import type { NicheProfile } from "@/lib/openai/types";
import { defaultNicheProfile } from "@/lib/openai/types";

export type NichePresetId =
  | "biology"
  | "saas"
  | "fitness"
  | "crypto"
  | "reversible-computing"
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
    id: "reversible-computing",
    label: "Reversible computing educator",
    description:
      "Explain reversible computing and energy-efficient computation (E-CoRe MSCA doctoral network).",
    niche: {
      ...defaultNicheProfile(),
      topic:
        "reversible computing (RC) and energy-efficient computation: Landauer's principle, reversible algorithms and programming languages, compilation and analysis, reversible circuits and architectures, and applications to blockchains, machine learning and drones — as researched and taught in the E-CoRe MSCA Doctoral Network",
      audience:
        "computer science and engineering students (MSc and prospective PhD applicants), early-career researchers, academics in programming languages, hardware and physics of computation, and industry engineers interested in green and low-energy computing",
      geography: "Europe (EU research and higher-education community), global academic audience",
      toneNotes:
        "Educator voice: start from intuition, then add rigor. Use concrete analogies (undo, running a program backwards, information as heat) and small worked examples. Enthusiastic about the 'RC revolution' but honest that full reversible processors are not yet commercially available. Accessible to a motivated student, never dumbed down for experts.",
      forbiddenTopics:
        "Claims that reversible computing gives free or zero-energy computation, perpetual-motion style hype, fixed dates for commercial reversible CPUs, unpublished or confidential project results, criticism of named researchers or partner institutions",
      complianceNotes:
        "EU-funded Horizon Europe MSCA Doctoral Network (E-CoRe, grant 101226672). When posting about the project, follow the Horizon Europe social media guide and acknowledge EU funding (e.g. 'Funded by the European Union — MSCA'). Views are the project's own, not the EU's. Recruitment posts must reflect open, transparent, merit-based hiring per the European Code of Conduct for the Recruitment of Researchers; no promises about selection outcomes.",
      extraInstructions:
        "Rotate formats: concept explainers (Landauer bound, bijective functions, garbage bits, Bennett's trick), myth vs fact, 'reversible in 60 seconds', reading recommendations, research highlights from the doctoral candidates, event and summer-school announcements, and PhD/doctoral-candidate recruitment calls. End explainers with one takeaway or question. Prefer hashtags like #ReversibleComputing #EnergyEfficientComputing #MSCA #HorizonEU #PhD.",
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
