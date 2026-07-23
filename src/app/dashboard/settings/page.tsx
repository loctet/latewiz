"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore, useAppStore, useAiStore } from "@/stores";
import { logoutLateWiz } from "@/components/session-bootstrap";
import { isPlausibleOpenAiApiKey } from "@/lib/openai/resolve-key";
import { isPlausibleFalApiKey } from "@/lib/fal/resolve-key";
import { VIDEO_PROVIDERS } from "@/lib/video-providers";
import { useOpenAiStatus } from "@/hooks";
import { toast } from "sonner";
import { getTimezoneOptions } from "@/lib/timezones";
import { PageContainer } from "@/components/dashboard";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { cn } from "@/lib/utils";
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
  FileText,
  Sparkles,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import {
  ImagePromptTemplatesEditor,
  PostPromptTemplatesEditor,
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

function StatusChip({
  label,
  ok,
  hint,
  optional,
}: {
  label: string;
  ok: boolean;
  hint?: string | null;
  optional?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : optional
            ? "border-border bg-muted text-muted-foreground"
            : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
      )}
    >
      {ok ? (
        <Check className="h-3 w-3" />
      ) : optional ? null : (
        <AlertTriangle className="h-3 w-3" />
      )}
      <span>
        {label}
        {ok && hint ? ` · ••••${hint}` : ok ? " · saved" : optional ? " · optional" : " · missing"}
      </span>
    </div>
  );
}

function PrefRow({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 sm:max-w-xs sm:w-full">{children}</div>
    </div>
  );
}

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
  const [section, setSection] = useState("keys");
  const [templateTab, setTemplateTab] = useState("post");

  const timezoneOptions = useMemo(
    () => getTimezoneOptions(timezone),
    [timezone]
  );

  const openaiConfigured = Boolean(
    vault?.hasOpenai || openAiStatus?.openai_configured
  );
  const falConfigured = Boolean(vault?.hasFal || openAiStatus?.fal_configured);

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
    <PageContainer className="max-w-4xl">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="h-4 w-4" />
          </span>
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          API vault, AI content prefs, and account options.
        </p>
      </div>

      <Tabs value={section} onValueChange={setSection} className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value="keys" className="cursor-pointer gap-1.5 text-xs sm:text-sm">
            <Shield className="h-3.5 w-3.5" />
            Keys
          </TabsTrigger>
          <TabsTrigger value="content" className="cursor-pointer gap-1.5 text-xs sm:text-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Content
          </TabsTrigger>
          <TabsTrigger value="preferences" className="cursor-pointer gap-1.5 text-xs sm:text-sm">
            <Globe className="h-3.5 w-3.5" />
            Preferences
          </TabsTrigger>
        </TabsList>

        {/* —— Keys / Vault —— */}
        <TabsContent value="keys" className="mt-0 space-y-4 animate-in fade-in-0 duration-200">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold">Encrypted API vault</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Keys are encrypted at rest with{" "}
                <code className="text-[11px]">VAULT_MASTER_KEY</code>. AI uses
                your keys — never the host&apos;s.
              </p>
            </div>

            <div className="mb-4 flex flex-wrap gap-1.5">
              <StatusChip
                label="Zernio"
                ok={Boolean(vault?.hasZernio)}
                hint={vault?.zernioHint}
              />
              <StatusChip
                label="OpenAI"
                ok={openaiConfigured}
                hint={vault?.openaiHint}
              />
              <StatusChip
                label="fal.ai"
                ok={falConfigured}
                hint={vault?.falHint}
                optional
              />
            </div>

            <div className="space-y-4">
              {/* Zernio */}
              <div className="space-y-1.5 rounded-lg border border-border/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="zernio-key" className="text-xs">
                    Zernio API key
                  </Label>
                  <Button
                    variant="link"
                    className="h-auto cursor-pointer p-0 text-xs"
                    asChild
                  >
                    <a
                      href="https://zernio.com/dashboard/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Manage keys
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                </div>
                <div className="flex gap-1.5">
                  <Input
                    id="zernio-key"
                    type={showZernio ? "text" : "password"}
                    placeholder="sk_…"
                    value={zernioInput}
                    onChange={(e) => setZernioInput(e.target.value)}
                    className="h-8 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    type="button"
                    size="icon"
                    className="h-8 w-8 shrink-0 cursor-pointer"
                    onClick={() => setShowZernio(!showZernio)}
                    aria-label={showZernio ? "Hide key" : "Show key"}
                  >
                    {showZernio ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 cursor-pointer"
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
                    Save
                  </Button>
                  {vault?.hasZernio && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 cursor-pointer"
                      disabled={saving}
                      onClick={() => void deleteVaultKey("zernio")}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              {/* OpenAI */}
              <div className="space-y-1.5 rounded-lg border border-border/80 p-3">
                <Label
                  htmlFor="openai-key"
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  OpenAI API key
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    id="openai-key"
                    type={showOpenAiKey ? "text" : "password"}
                    placeholder="sk-…"
                    value={openAiKeyInput}
                    onChange={(e) => setOpenAiKeyInput(e.target.value)}
                    className="h-8 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    type="button"
                    size="icon"
                    className="h-8 w-8 shrink-0 cursor-pointer"
                    onClick={() => setShowOpenAiKey(!showOpenAiKey)}
                    aria-label={showOpenAiKey ? "Hide key" : "Show key"}
                  >
                    {showOpenAiKey ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 cursor-pointer"
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
                    Save
                  </Button>
                  {vault?.hasOpenai && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 cursor-pointer"
                      disabled={saving}
                      onClick={() => void deleteVaultKey("openai")}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              {/* fal */}
              <div className="space-y-1.5 rounded-lg border border-border/80 p-3">
                <Label htmlFor="fal-key" className="text-xs">
                  fal.ai API key (Pika video)
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    id="fal-key"
                    type={showFalKey ? "text" : "password"}
                    placeholder="fal key"
                    value={falKeyInput}
                    onChange={(e) => setFalKeyInput(e.target.value)}
                    className="h-8 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    type="button"
                    size="icon"
                    className="h-8 w-8 shrink-0 cursor-pointer"
                    onClick={() => setShowFalKey(!showFalKey)}
                    aria-label={showFalKey ? "Hide key" : "Show key"}
                  >
                    {showFalKey ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 cursor-pointer"
                    disabled={saving}
                    onClick={() => {
                      const k = falKeyInput.trim();
                      if (!isPlausibleFalApiKey(k)) {
                        toast.error("Invalid fal.ai key format");
                        return;
                      }
                      void saveVaultKeys({ fal: k }).then(() =>
                        setFalKeyInput("")
                      );
                    }}
                  >
                    Save
                  </Button>
                  {vault?.hasFal && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 cursor-pointer"
                      disabled={saving}
                      onClick={() => void deleteVaultKey("fal")}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {usageStats && (
              <div className="mt-4 flex items-center justify-between rounded-lg bg-muted px-3 py-2.5 text-sm">
                <span className="font-medium">{usageStats.planName}</span>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto cursor-pointer p-0"
                  asChild
                >
                  <a
                    href="https://zernio.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Manage plan
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* —— Content / AI —— */}
        <TabsContent value="content" className="mt-0 space-y-4 animate-in fade-in-0 duration-200">
          <div className="rounded-xl border border-border bg-card px-4 shadow-sm sm:px-5">
            <PrefRow
              icon={<Target className="h-3.5 w-3.5" />}
              title="Content niche"
              description="Language, audience, tone, and compliance"
            >
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full cursor-pointer"
                asChild
              >
                <Link href="/dashboard/niche">
                  Edit niche
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </PrefRow>

            <PrefRow
              icon={<Film className="h-3.5 w-3.5" />}
              title="Video provider"
              description="Used for AI video generation"
            >
              <Select
                value={videoProvider}
                onValueChange={(v) =>
                  setVideoProvider(v as (typeof VIDEO_PROVIDERS)[number]["id"])
                }
              >
                <SelectTrigger className="h-8 w-full cursor-pointer">
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
            </PrefRow>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-3">
              <h2 className="text-sm font-semibold">Prompt templates</h2>
              <p className="text-xs text-muted-foreground">
                Customize structure with placeholders like{" "}
                <code className="text-[11px]">{"{{subject}}"}</code>.
              </p>
            </div>
            <Tabs value={templateTab} onValueChange={setTemplateTab}>
              <TabsList className="mb-3 h-8 w-full justify-start gap-1">
                <TabsTrigger
                  value="post"
                  className="cursor-pointer gap-1 text-xs"
                >
                  <FileText className="h-3 w-3" />
                  Post
                </TabsTrigger>
                <TabsTrigger
                  value="image"
                  className="cursor-pointer gap-1 text-xs"
                >
                  <ImageIcon className="h-3 w-3" />
                  Image
                </TabsTrigger>
                <TabsTrigger
                  value="video"
                  className="cursor-pointer gap-1 text-xs"
                >
                  <Film className="h-3 w-3" />
                  Video
                </TabsTrigger>
              </TabsList>
              <TabsContent value="post" className="mt-0">
                <PostPromptTemplatesEditor />
              </TabsContent>
              <TabsContent value="image" className="mt-0">
                <ImagePromptTemplatesEditor />
              </TabsContent>
              <TabsContent value="video" className="mt-0">
                <VideoPromptTemplatesEditor />
              </TabsContent>
            </Tabs>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Stamp className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Image watermark</h2>
            </div>
            <ImageWatermarkSettings />
          </div>
        </TabsContent>

        {/* —— Preferences —— */}
        <TabsContent
          value="preferences"
          className="mt-0 animate-in fade-in-0 duration-200"
        >
          <div className="rounded-xl border border-border bg-card px-4 shadow-sm sm:px-5">
            <PrefRow
              icon={<Globe className="h-3.5 w-3.5" />}
              title="Timezone"
              description="Used for scheduling and queue slots"
            >
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="h-8 w-full cursor-pointer">
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
            </PrefRow>

            <PrefRow
              icon={
                theme === "dark" ? (
                  <Moon className="h-3.5 w-3.5" />
                ) : (
                  <Sun className="h-3.5 w-3.5" />
                )
              }
              title="Appearance"
              description="Switch between light and dark"
            >
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full cursor-pointer"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                Switch to {theme === "dark" ? "light" : "dark"} mode
              </Button>
            </PrefRow>

            <PrefRow
              icon={<LogOut className="h-3.5 w-3.5" />}
              title="Sign out"
              description="Vault keys stay encrypted on the server"
            >
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 w-full cursor-pointer"
                  >
                    Sign out
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sign out?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You will need to sign in again. Vault keys stay encrypted
                      on the server.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="cursor-pointer">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="cursor-pointer"
                      onClick={handleLogout}
                    >
                      Sign out
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </PrefRow>
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
