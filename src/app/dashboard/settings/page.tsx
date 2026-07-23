"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore, useAppStore, useAiStore } from "@/stores";
import { logoutLateWiz } from "@/components/session-bootstrap";
import { isPlausibleOpenAiApiKey } from "@/lib/openai/resolve-key";
import { isPlausibleFalApiKey } from "@/lib/fal/resolve-key";
import { VIDEO_PROVIDERS } from "@/lib/video-providers";
import { useOpenAiStatus } from "@/hooks";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getTimezoneOptions } from "@/lib/timezones";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Moon,
  Sun,
  Globe,
  LogOut,
  ExternalLink,
  Target,
  ImageIcon,
  Film,
  Stamp,
  Shield,
} from "lucide-react";
import Link from "next/link";
import {
  ImagePromptTemplatesEditor,
  VideoPromptTemplatesEditor,
  ImageWatermarkSettings,
} from "@/components/settings";

type VaultStatus = {
  hasZernio: boolean;
  hasOpenai: boolean;
  hasFal: boolean;
  zernioHint: string | null;
  openaiHint: string | null;
  falHint: string | null;
};

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { usageStats, setApiKey } = useAuthStore();
  const { timezone, setTimezone } = useAppStore();
  const { videoProvider, setVideoProvider } = useAiStore();
  const { data: openAiStatus } = useOpenAiStatus();

  const { data: vault } = useQuery({
    queryKey: ["vault-status"],
    queryFn: async () => {
      const res = await fetch("/api/vault");
      if (!res.ok) throw new Error("Failed to load vault");
      return res.json() as Promise<VaultStatus>;
    },
  });

  const [zernioInput, setZernioInput] = useState("");
  const [openAiKeyInput, setOpenAiKeyInput] = useState("");
  const [falKeyInput, setFalKeyInput] = useState("");
  const [showZernio, setShowZernio] = useState(false);
  const [showOpenAiKey, setShowOpenAiKey] = useState(false);
  const [showFalKey, setShowFalKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const timezoneOptions = useMemo(
    () => getTimezoneOptions(timezone),
    [timezone]
  );

  const handleLogout = async () => {
    await logoutLateWiz();
    router.push("/");
  };

  async function saveVaultKeys(payload: {
    zernio?: string;
    openai?: string;
    fal?: string;
  }) {
    setSaving(true);
    try {
      const res = await fetch("/api/vault", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save");
      await queryClient.invalidateQueries({ queryKey: ["vault-status"] });
      await queryClient.invalidateQueries({ queryKey: ["openai-status"] });
      if (payload.zernio) {
        setApiKey(payload.zernio);
      }
      toast.success("Keys saved to encrypted vault");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save keys");
    } finally {
      setSaving(false);
    }
  }

  async function deleteVaultKey(kind: "zernio" | "openai" | "fal") {
    setSaving(true);
    try {
      const res = await fetch(`/api/vault/${kind}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      await queryClient.invalidateQueries({ queryKey: ["vault-status"] });
      await queryClient.invalidateQueries({ queryKey: ["openai-status"] });
      if (kind === "zernio") setApiKey(null);
      toast.success("Key removed from vault");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete key");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account, encrypted API vault, and preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Encrypted API vault
          </CardTitle>
          <CardDescription>
            Keys are encrypted at rest with{" "}
            <code className="text-xs">VAULT_MASTER_KEY</code>. AI and deferred
            campaigns use <strong>your</strong> keys — never the host&apos;s.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <p>
              Zernio:{" "}
              {vault?.hasZernio ? (
                <span className="font-medium text-green-600 dark:text-green-400">
                  Saved ••••{vault.zernioHint}
                </span>
              ) : (
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  Missing
                </span>
              )}
            </p>
            <p>
              OpenAI:{" "}
              {vault?.hasOpenai || openAiStatus?.openai_configured ? (
                <span className="font-medium text-green-600 dark:text-green-400">
                  Saved{vault?.openaiHint ? ` ••••${vault.openaiHint}` : ""}
                </span>
              ) : (
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  Missing
                </span>
              )}
            </p>
            <p>
              fal.ai:{" "}
              {vault?.hasFal || openAiStatus?.fal_configured ? (
                <span className="font-medium text-green-600 dark:text-green-400">
                  Saved{vault?.falHint ? ` ••••${vault.falHint}` : ""}
                </span>
              ) : (
                <span className="text-muted-foreground">Optional</span>
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Zernio API key</Label>
            <div className="flex gap-2">
              <Input
                type={showZernio ? "text" : "password"}
                placeholder="sk_…"
                value={zernioInput}
                onChange={(e) => setZernioInput(e.target.value)}
                className="font-mono"
              />
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowZernio(!showZernio)}
              >
                {showZernio ? "Hide" : "Show"}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={saving}
                onClick={() => {
                  const k = zernioInput.trim();
                  if (!k.startsWith("sk_")) {
                    toast.error("Invalid Zernio key (must start with sk_)");
                    return;
                  }
                  void saveVaultKeys({ zernio: k }).then(() =>
                    setZernioInput("")
                  );
                }}
              >
                Save Zernio key
              </Button>
              {vault?.hasZernio && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void deleteVaultKey("zernio")}
                >
                  Remove
                </Button>
              )}
            </div>
            <Button variant="link" className="h-auto p-0" asChild>
              <a
                href="https://zernio.com/dashboard/api-keys"
                target="_blank"
                rel="noopener noreferrer"
              >
                Manage Zernio keys
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              OpenAI API key
            </Label>
            <div className="flex gap-2">
              <Input
                type={showOpenAiKey ? "text" : "password"}
                placeholder="sk-…"
                value={openAiKeyInput}
                onChange={(e) => setOpenAiKeyInput(e.target.value)}
                className="font-mono"
              />
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowOpenAiKey(!showOpenAiKey)}
              >
                {showOpenAiKey ? "Hide" : "Show"}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={saving}
                onClick={() => {
                  const k = openAiKeyInput.trim();
                  if (!isPlausibleOpenAiApiKey(k)) {
                    toast.error("Invalid OpenAI key format");
                    return;
                  }
                  void saveVaultKeys({ openai: k }).then(() =>
                    setOpenAiKeyInput("")
                  );
                }}
              >
                Save OpenAI key
              </Button>
              {vault?.hasOpenai && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void deleteVaultKey("openai")}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label>fal.ai API key (Pika video)</Label>
            <div className="flex gap-2">
              <Input
                type={showFalKey ? "text" : "password"}
                placeholder="fal key"
                value={falKeyInput}
                onChange={(e) => setFalKeyInput(e.target.value)}
                className="font-mono"
              />
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowFalKey(!showFalKey)}
              >
                {showFalKey ? "Hide" : "Show"}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  const k = falKeyInput.trim();
                  if (!isPlausibleFalApiKey(k)) {
                    toast.error("Invalid fal.ai key format");
                    return;
                  }
                  void saveVaultKeys({ fal: k }).then(() => setFalKeyInput(""));
                }}
              >
                Save fal key
              </Button>
              {vault?.hasFal && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void deleteVaultKey("fal")}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>

          {usageStats && (
            <div className="rounded-lg bg-muted p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{usageStats.planName}</span>
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <a
                    href="https://zernio.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Manage Plan
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" />
            Content niche
          </CardTitle>
          <CardDescription>
            Language, audience, tone, and compliance rules for AI generation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/dashboard/niche">
              Edit content niche
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Film className="h-4 w-4" />
            Video provider
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={videoProvider}
            onValueChange={(v) =>
              setVideoProvider(v as (typeof VIDEO_PROVIDERS)[number]["id"])
            }
          >
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIDEO_PROVIDERS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-4 w-4" />
            Image prompt templates
          </CardTitle>
          <CardDescription>
            Customize styles with <code className="text-xs">{"{{subject}}"}</code>{" "}
            and <code className="text-xs">{"{{langNote}}"}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImagePromptTemplatesEditor />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Film className="h-4 w-4" />
            Video prompt templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <VideoPromptTemplatesEditor />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Stamp className="h-4 w-4" />
            Image watermark
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ImageWatermarkSettings />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            Timezone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timezoneOptions.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {theme === "dark" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            Switch to {theme === "dark" ? "light" : "dark"} mode
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <LogOut className="h-4 w-4" />
            Sign out
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Sign out</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out?</AlertDialogTitle>
                <AlertDialogDescription>
                  You will need to sign in again. Vault keys stay encrypted on the
                  server.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleLogout}>
                  Sign out
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
