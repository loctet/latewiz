"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useAiStore, useAuthStore } from "@/stores";
import { NICHE_PRESETS, type NichePresetId } from "@/lib/niche-presets";
import { defaultNicheProfile, type NicheProfile } from "@/lib/openai/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Step = "niche" | "keys" | "import";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const setApiKey = useAuthStore((s) => s.setApiKey);
  const localOpenai = useAiStore((s) => s.openaiApiKey);
  const localFal = useAiStore((s) => s.falApiKey);
  const localNiche = useAiStore((s) => s.niche);
  const clearLocalOpenai = useAiStore((s) => s.setOpenaiApiKey);
  const clearLocalFal = useAiStore((s) => s.setFalApiKey);
  const legacyZernio = useAuthStore((s) => s.apiKey);

  const [step, setStep] = useState<Step>("niche");
  const [presetId, setPresetId] = useState<NichePresetId>("biology");
  const [niche, setNiche] = useState<NicheProfile>(NICHE_PRESETS[0].niche);
  const [zernioKey, setZernioKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [falKey, setFalKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasLegacyKeys, setHasLegacyKeys] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time legacy import seed
  }, []);

  function selectPreset(id: NichePresetId) {
    setPresetId(id);
    const preset = NICHE_PRESETS.find((p) => p.id === id);
    if (preset) setNiche({ ...preset.niche });
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
      setStep(hasLegacyKeys ? "import" : "keys");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save niche");
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
        body: JSON.stringify({ niche, onboardingCompleted: true }),
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

      toast.success("Vault ready — welcome to LateWiz");
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
            Niche + your own API keys. Nothing posts or bills to someone else.
          </p>
        </div>

        {step === "niche" && (
          <form onSubmit={saveNicheAndContinue} className="space-y-4 rounded-lg border bg-card p-6">
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
                onChange={(e) => setNiche((n) => ({ ...n, audience: e.target.value }))}
                placeholder="Who are you writing for?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tone">Tone notes</Label>
              <Textarea
                id="tone"
                value={niche.toneNotes}
                onChange={(e) => setNiche((n) => ({ ...n, toneNotes: e.target.value }))}
                rows={3}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              Continue
            </Button>
          </form>
        )}

        {step === "import" && (
          <div className="space-y-4 rounded-lg border bg-card p-6">
            <h2 className="font-semibold">Import keys from this browser?</h2>
            <p className="text-sm text-muted-foreground">
              We found API keys saved locally from the old single-user mode. Import them into your
              encrypted vault, or enter new keys.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1"
                onClick={() => setStep("keys")}
              >
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
          <form onSubmit={saveKeys} className="space-y-4 rounded-lg border bg-card p-6">
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
              <p className="text-xs text-muted-foreground">
                From{" "}
                <a
                  href="https://zernio.com/dashboard/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  zernio.com
                </a>
                . Posts go to accounts on this key.
              </p>
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
                AI captions, images, and video use your OpenAI billing — not the host&apos;s.
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
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Saving…" : "Save vault & open dashboard"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
