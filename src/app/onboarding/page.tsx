"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useAiStore, useAuthStore } from "@/stores";
import { NICHE_PRESETS, type NichePresetId } from "@/lib/niche-presets";
import { defaultNicheProfile, type NicheProfile } from "@/lib/openai/types";
import {
  DEFAULT_POST_PROMPT_STYLE_ID,
  POST_PROMPT_STYLES,
  getPostPromptStyle,
} from "@/lib/post-prompt-catalog";
import {
  DEFAULT_IMAGE_PROMPT_STYLE_ID,
  IMAGE_PROMPT_STYLES,
  getEffectiveTemplate,
} from "@/lib/image-prompt-catalog";
import {
  DEFAULT_IMAGE_WATERMARK_TEXT,
  IMAGE_WATERMARK_POSITIONS,
  type ImageWatermarkPosition,
} from "@/lib/image-watermark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Step = "niche" | "content" | "keys" | "import";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const setApiKey = useAuthStore((s) => s.setApiKey);
  const aiStore = useAiStore();
  const localOpenai = useAiStore((s) => s.openaiApiKey);
  const localFal = useAiStore((s) => s.falApiKey);
  const localNiche = useAiStore((s) => s.niche);
  const clearLocalOpenai = useAiStore((s) => s.setOpenaiApiKey);
  const clearLocalFal = useAiStore((s) => s.setFalApiKey);
  const legacyZernio = useAuthStore((s) => s.apiKey);

  const [step, setStep] = useState<Step>("niche");
  const [presetId, setPresetId] = useState<NichePresetId>("biology");
  const [niche, setNiche] = useState<NicheProfile>(NICHE_PRESETS[0].niche);
  const [postStyleId, setPostStyleId] = useState(DEFAULT_POST_PROMPT_STYLE_ID);
  const [imageStyleId, setImageStyleId] = useState(DEFAULT_IMAGE_PROMPT_STYLE_ID);
  const [postTemplate, setPostTemplate] = useState(
    getPostPromptStyle(DEFAULT_POST_PROMPT_STYLE_ID).structureTemplate
  );
  const [imageTemplate, setImageTemplate] = useState(
    getEffectiveTemplate(DEFAULT_IMAGE_PROMPT_STYLE_ID)
  );
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [watermarkText, setWatermarkText] = useState(DEFAULT_IMAGE_WATERMARK_TEXT);
  const [watermarkPosition, setWatermarkPosition] =
    useState<ImageWatermarkPosition>("bottom-right");
  const [zernioKey, setZernioKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [falKey, setFalKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasLegacyKeys, setHasLegacyKeys] = useState(false);

  const stepIndex = useMemo(() => {
    const order: Step[] = ["niche", "content", "keys"];
    return Math.max(0, order.indexOf(step === "import" ? "keys" : step)) + 1;
  }, [step]);

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login?next=/onboarding");
    }
  }, [isPending, session, router]);

  useEffect(() => {
    const legacy =
      Boolean(legacyZernio) || Boolean(localOpenai) || Boolean(localFal);
    setHasLegacyKeys(legacy);
    if (legacyZernio && !zernioKey) setZernioKey(legacyZernio);
    if (localOpenai && !openaiKey) setOpenaiKey(localOpenai);
    if (localFal && !falKey) setFalKey(localFal);
    if (localNiche?.topic?.trim()) {
      setNiche({ ...defaultNicheProfile(), ...localNiche });
      setPresetId("custom");
    }
    if (aiStore.imageWatermarkText?.trim()) {
      setWatermarkText(aiStore.imageWatermarkText);
      setWatermarkEnabled(aiStore.imageWatermarkEnabled);
      setWatermarkPosition(aiStore.imageWatermarkPosition);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time seed
  }, []);

  function selectPreset(id: NichePresetId) {
    setPresetId(id);
    const preset = NICHE_PRESETS.find((p) => p.id === id);
    if (preset) setNiche({ ...preset.niche });
  }

  function onPostStyleChange(id: string) {
    setPostStyleId(id);
    setPostTemplate(getPostPromptStyle(id).structureTemplate);
  }

  function onImageStyleChange(id: string) {
    setImageStyleId(id);
    setImageTemplate(getEffectiveTemplate(id));
  }

  async function saveNicheAndContinue(e: FormEvent) {
    e.preventDefault();
    if (!niche.topic.trim()) {
      toast.error("Add a topic for your niche");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, onboardingCompleted: false }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save niche");
      }
      useAiStore.getState().setNiche(niche);
      setStep("content");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save niche");
    } finally {
      setSaving(false);
    }
  }

  async function saveContentAndContinue(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const contentPrefs = {
        postPromptStyleId: postStyleId,
        imagePromptStyleId: imageStyleId,
        postPromptTemplates: {
          [postStyleId]: postTemplate,
        },
        imagePromptTemplates: {
          [imageStyleId]: imageTemplate,
        },
        imageWatermarkEnabled: watermarkEnabled,
        imageWatermarkText: watermarkText.trim() || DEFAULT_IMAGE_WATERMARK_TEXT,
        imageWatermarkOpacity: aiStore.imageWatermarkOpacity,
        imageWatermarkPosition: watermarkPosition,
      };

      const res = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche,
          contentPrefs,
          onboardingCompleted: false,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save content settings");
      }

      useAiStore.getState().hydrateContentPrefs(contentPrefs);
      setStep(hasLegacyKeys ? "import" : "keys");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save content settings"
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveKeys(e: FormEvent) {
    e.preventDefault();
    if (!zernioKey.trim().startsWith("sk_")) {
      toast.error("Enter your Zernio API key (sk_…)");
      return;
    }
    if (!openaiKey.trim().startsWith("sk-")) {
      toast.error("Enter your OpenAI API key so AI runs on your account");
      return;
    }
    setSaving(true);
    try {
      const vaultRes = await fetch("/api/vault", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zernio: zernioKey.trim(),
          openai: openaiKey.trim(),
          ...(falKey.trim() ? { fal: falKey.trim() } : {}),
        }),
      });
      if (!vaultRes.ok) {
        const data = await vaultRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save keys");
      }

      const profileRes = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche,
          contentPrefs: useAiStore.getState().getContentPrefs(),
          onboardingCompleted: true,
        }),
      });
      if (!profileRes.ok) {
        const data = await profileRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to complete onboarding");
      }

      setApiKey(zernioKey.trim());
      clearLocalOpenai(null);
      clearLocalFal(null);
      try {
        localStorage.removeItem("latewiz-auth");
      } catch {
        /* ignore */
      }

      toast.success("Workspace ready — welcome to LateWiz");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save keys");
    } finally {
      setSaving(false);
    }
  }

  if (isPending || !session) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo size="md" />
          <h1 className="text-2xl font-bold">Set up your workspace</h1>
          <p className="text-sm text-muted-foreground">
            Niche, content style, and your own API keys — step {stepIndex} of 3
          </p>
        </div>

        {step === "niche" && (
          <form
            onSubmit={saveNicheAndContinue}
            className="space-y-4 rounded-lg border bg-card p-6"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {NICHE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => selectPreset(preset.id)}
                  className={cn(
                    "rounded-md border p-3 text-left text-sm transition-colors",
                    presetId === preset.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="font-medium">{preset.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {preset.description}
                  </div>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic">Topic</Label>
              <Input
                id="topic"
                value={niche.topic}
                onChange={(e) => setNiche((n) => ({ ...n, topic: e.target.value }))}
                placeholder="e.g. molecular biology research"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audience">Audience</Label>
              <Input
                id="audience"
                value={niche.audience}
                onChange={(e) =>
                  setNiche((n) => ({ ...n, audience: e.target.value }))
                }
                placeholder="Who are you writing for?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tone">Tone notes</Label>
              <Textarea
                id="tone"
                value={niche.toneNotes}
                onChange={(e) =>
                  setNiche((n) => ({ ...n, toneNotes: e.target.value }))
                }
                rows={3}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              Continue to content style
            </Button>
          </form>
        )}

        {step === "content" && (
          <form
            onSubmit={saveContentAndContinue}
            className="space-y-5 rounded-lg border bg-card p-6"
          >
            <div className="space-y-2">
              <Label>Default post style</Label>
              <Select value={postStyleId} onValueChange={onPostStyleChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POST_PROMPT_STYLES.map((style) => (
                    <SelectItem key={style.id} value={style.id}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {POST_PROMPT_STYLES.find((s) => s.id === postStyleId)?.description}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-template">Customize post prompt</Label>
              <Textarea
                id="post-template"
                value={postTemplate}
                onChange={(e) => setPostTemplate(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Placeholders: {"{{subject}}"}, {"{{goal}}"}, {"{{minBodyChars}}"}
              </p>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label>Default image style</Label>
              <Select value={imageStyleId} onValueChange={onImageStyleChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_PROMPT_STYLES.map((style) => (
                    <SelectItem key={style.id} value={style.id}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {IMAGE_PROMPT_STYLES.find((s) => s.id === imageStyleId)?.description}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="image-template">Customize image prompt</Label>
              <Textarea
                id="image-template"
                value={imageTemplate}
                onChange={(e) => setImageTemplate(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Placeholders: {"{{subject}}"}, {"{{langNote}}"}, {"{{credit}}"}
              </p>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="wm-enabled">Image watermark</Label>
                  <p className="text-xs text-muted-foreground">
                    Default signature on generated images
                  </p>
                </div>
                <Switch
                  id="wm-enabled"
                  checked={watermarkEnabled}
                  onCheckedChange={setWatermarkEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wm-text">Watermark text</Label>
                <Input
                  id="wm-text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder={DEFAULT_IMAGE_WATERMARK_TEXT}
                />
              </div>
              <div className="space-y-2">
                <Label>Position</Label>
                <Select
                  value={watermarkPosition}
                  onValueChange={(v) =>
                    setWatermarkPosition(v as ImageWatermarkPosition)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_WATERMARK_POSITIONS.map((pos) => (
                      <SelectItem key={pos.value} value={pos.value}>
                        {pos.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep("niche")}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                Continue to API keys
              </Button>
            </div>
          </form>
        )}

        {step === "import" && (
          <div className="space-y-4 rounded-lg border bg-card p-6">
            <h2 className="font-semibold">Import keys from this browser?</h2>
            <p className="text-sm text-muted-foreground">
              We found API keys saved locally from the old single-user mode. Import
              them into your encrypted vault, or enter new keys.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={() => setStep("keys")}>
                Review & import
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setZernioKey("");
                  setOpenaiKey("");
                  setFalKey("");
                  setStep("keys");
                }}
              >
                Enter new keys
              </Button>
            </div>
          </div>
        )}

        {step === "keys" && (
          <form
            onSubmit={saveKeys}
            className="space-y-4 rounded-lg border bg-card p-6"
          >
            <div className="space-y-2">
              <Label htmlFor="zernio">Zernio API key</Label>
              <Input
                id="zernio"
                type="password"
                value={zernioKey}
                onChange={(e) => setZernioKey(e.target.value)}
                placeholder="sk_…"
                required
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="openai">OpenAI API key</Label>
              <Input
                id="openai"
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-…"
                required
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                AI captions and images use your OpenAI billing — not the host&apos;s.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fal">fal API key (optional)</Label>
              <Input
                id="fal"
                type="password"
                value={falKey}
                onChange={(e) => setFalKey(e.target.value)}
                placeholder="For Pika video"
                className="font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep("content")}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Saving…" : "Finish setup"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
