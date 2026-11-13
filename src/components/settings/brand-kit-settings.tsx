"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BRAND_FONT_OPTIONS,
  BRAND_ILLUSTRATION_STYLES,
  BRAND_VOICES,
  BRAND_LOGO_CONTENT_TYPES,
  BRAND_LOGO_MAX_BYTES,
  BRAND_LOGO_POSITIONS,
  BRAND_VIDEO_THEMES,
  defaultBrandKit,
  type BrandKit,
  type BrandKitResponse,
} from "@/lib/brand-kit";
import { cn } from "@/lib/utils";
import { Loader2, Trash2, Upload } from "lucide-react";

type ColorKey =
  | "primaryColor"
  | "secondaryColor"
  | "accentColor"
  | "backgroundColor"
  | "textColor";

const COLOR_FIELDS: { key: ColorKey; label: string }[] = [
  { key: "primaryColor", label: "Primary" },
  { key: "secondaryColor", label: "Secondary" },
  { key: "accentColor", label: "Accent" },
  { key: "backgroundColor", label: "Background" },
  { key: "textColor", label: "Text" },
];

function splitResponse(res: BrandKitResponse): {
  kit: BrandKit;
  hasLogo: boolean;
  logoUpdatedAt: string | null;
} {
  const { hasLogo, logoUpdatedAt, ...kit } = res;
  return { kit, hasLogo, logoUpdatedAt };
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || fallback;
}

export function BrandKitSettings() {
  const [kit, setKit] = useState<BrandKit>(defaultBrandKit());
  const [hasLogo, setHasLogo] = useState(false);
  const [logoUpdatedAt, setLogoUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const dirtyRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/brand-kit")
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res, "Failed to load brand kit"));
        return (await res.json()) as BrandKitResponse;
      })
      .then((data) => {
        if (cancelled) return;
        const parts = splitResponse(data);
        setKit(parts.kit);
        setHasLogo(parts.hasLogo);
        setLogoUpdatedAt(parts.logoUpdatedAt);
      })
      .catch((err: Error) => {
        if (!cancelled) toast.error(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced auto-save, same pattern as the watermark settings.
  useEffect(() => {
    if (loading || !dirtyRef.current) return;
    const timer = setTimeout(() => {
      setSaving(true);
      fetch("/api/me/brand-kit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kit),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(await readError(res, "Failed to save brand kit"));
          dirtyRef.current = false;
        })
        .catch((err: Error) => toast.error(err.message))
        .finally(() => setSaving(false));
    }, 700);
    return () => clearTimeout(timer);
  }, [kit, loading]);

  function update<K extends keyof BrandKit>(key: K, value: BrandKit[K]) {
    dirtyRef.current = true;
    setKit((prev) => ({ ...prev, [key]: value }));
  }

  async function uploadLogo(file: File) {
    if (!(BRAND_LOGO_CONTENT_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Logo must be PNG, JPEG, WebP or SVG");
      return;
    }
    if (file.size > BRAND_LOGO_MAX_BYTES) {
      toast.error(`Logo must be ${BRAND_LOGO_MAX_BYTES / 1024} KB or smaller`);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/me/brand-kit/logo", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(await readError(res, "Failed to upload logo"));
      const parts = splitResponse((await res.json()) as BrandKitResponse);
      setHasLogo(parts.hasLogo);
      setLogoUpdatedAt(parts.logoUpdatedAt);
      toast.success("Logo updated");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeLogo() {
    setUploading(true);
    try {
      const res = await fetch("/api/me/brand-kit/logo", { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, "Failed to remove logo"));
      setHasLogo(false);
      setLogoUpdatedAt(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading brand kit…
      </div>
    );
  }

  const logoSrc = hasLogo
    ? `/api/me/brand-kit/logo?v=${encodeURIComponent(logoUpdatedAt ?? "")}`
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
      <div className="space-y-5">
        <p className="text-xs text-muted-foreground">
          Used to theme explainer videos: colors, font, logo and outro
          signature. Changes save automatically
          {saving ? " — saving…" : "."}
        </p>

        {/* Logo */}
        <div className="space-y-2">
          <Label>Logo</Label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              {logoSrc ? (
                <img src={logoSrc} alt="Brand logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-[10px] text-muted-foreground">No logo</span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={BRAND_LOGO_CONTENT_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadLogo(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              {hasLogo ? "Replace" : "Upload"}
            </Button>
            {hasLogo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploading}
                onClick={() => void removeLogo()}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            PNG with transparent background works best. Max{" "}
            {BRAND_LOGO_MAX_BYTES / 1024} KB.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="brand-name">Brand name</Label>
            <Input
              id="brand-name"
              value={kit.brandName}
              maxLength={60}
              onChange={(e) => update("brandName", e.target.value)}
              placeholder="Acme Studio"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-handle">Handle</Label>
            <Input
              id="brand-handle"
              value={kit.handle}
              maxLength={60}
              onChange={(e) => update("handle", e.target.value)}
              placeholder="@acmestudio"
            />
          </div>
        </div>

        {/* Colors */}
        <div className="space-y-2">
          <Label>Colors</Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {COLOR_FIELDS.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-lg border p-2"
              >
                <input
                  type="color"
                  value={kit[key]}
                  onChange={(e) => update(key, e.target.value.toUpperCase())}
                  className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                  aria-label={`${label} color`}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium">{label}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">
                    {kit[key]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Font</Label>
            <Select
              value={kit.fontFamily}
              onValueChange={(v) => update("fontFamily", v as BrandKit["fontFamily"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRAND_FONT_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Video theme</Label>
            <Select
              value={kit.videoTheme}
              onValueChange={(v) => update("videoTheme", v as BrandKit["videoTheme"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRAND_VIDEO_THEMES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Logo position</Label>
            <Select
              value={kit.logoPosition}
              onValueChange={(v) => update("logoPosition", v as BrandKit["logoPosition"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRAND_LOGO_POSITIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">
          {BRAND_VIDEO_THEMES.find((t) => t.value === kit.videoTheme)?.description}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="brand-signature">Signature</Label>
            <Input
              id="brand-signature"
              value={kit.signature}
              maxLength={80}
              onChange={(e) => update("signature", e.target.value)}
              placeholder="— Jane Doe, Founder"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-cta">Outro call to action</Label>
            <Input
              id="brand-cta"
              value={kit.ctaText}
              maxLength={60}
              onChange={(e) => update("ctaText", e.target.value)}
              placeholder="Follow for more"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="brand-website">Website</Label>
            <Input
              id="brand-website"
              value={kit.website}
              maxLength={120}
              onChange={(e) => update("website", e.target.value)}
              placeholder="acme.studio"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Illustration style</Label>
            <Select
              value={kit.illustrationStyle}
              onValueChange={(v) =>
                update("illustrationStyle", v as BrandKit["illustrationStyle"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRAND_ILLUSTRATION_STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Narrator voice</Label>
            <Select
              value={kit.voice}
              disabled={!kit.voiceoverEnabled}
              onValueChange={(v) => update("voice", v as BrandKit["voice"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRAND_VOICES.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">
          Explainer videos get an AI illustration per scene and a spoken
          voiceover, generated with your OpenAI key: one image per scene
          (usually 5–8) plus a short text-to-speech clip.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <Label htmlFor="brand-voiceover">Voiceover</Label>
            <Switch
              id="brand-voiceover"
              checked={kit.voiceoverEnabled}
              onCheckedChange={(v) => update("voiceoverEnabled", v)}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <Label htmlFor="brand-captions">Animated captions</Label>
            <Switch
              id="brand-captions"
              checked={kit.captionsEnabled}
              onCheckedChange={(v) => update("captionsEnabled", v)}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <Label htmlFor="brand-intro">Logo intro</Label>
            <Switch
              id="brand-intro"
              checked={kit.showIntro}
              onCheckedChange={(v) => update("showIntro", v)}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <Label htmlFor="brand-outro">Signature outro</Label>
            <Switch
              id="brand-outro"
              checked={kit.showOutro}
              onCheckedChange={(v) => update("showOutro", v)}
            />
          </div>
        </div>
      </div>

      <BrandKitPreview kit={kit} logoSrc={logoSrc} />
    </div>
  );
}

const LOGO_POSITION_CLASS: Record<BrandKit["logoPosition"], string> = {
  "top-left": "left-3 top-3",
  "top-right": "right-3 top-3",
  "bottom-left": "bottom-3 left-3",
  "bottom-right": "bottom-3 right-3",
};

/** Static 9:16 mock of one explainer scene — a rough guide, not the render. */
function BrandKitPreview({ kit, logoSrc }: { kit: BrandKit; logoSrc: string | null }) {
  const background =
    kit.videoTheme === "gradient"
      ? `linear-gradient(160deg, ${kit.primaryColor}, ${kit.secondaryColor})`
      : kit.videoTheme === "minimal"
        ? "#FAFAF7"
        : kit.backgroundColor;
  const textColor = kit.videoTheme === "minimal" ? "#111111" : kit.textColor;
  const fontFamily =
    kit.videoTheme === "editorial" ? "'Playfair Display', Georgia, serif" : `'${kit.fontFamily}', system-ui, sans-serif`;

  return (
    <div className="space-y-2">
      <Label>Preview</Label>
      <div
        className="relative mx-auto aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-xl border shadow-sm"
        style={{ background, color: textColor, fontFamily }}
      >
        {logoSrc && (
          <img
            src={logoSrc}
            alt=""
            className={cn("absolute h-7 max-w-[40%] object-contain", LOGO_POSITION_CLASS[kit.logoPosition])}
          />
        )}
        <div className="flex h-full flex-col justify-center gap-3 px-5">
          <span
            className="h-1 w-10 rounded-full"
            style={{ background: kit.accentColor }}
          />
          <p className="text-lg font-bold leading-tight">
            3 ways to grow your audience
          </p>
          <p className="text-[11px] opacity-80">
            Short, branded explainer scenes generated from each post.
          </p>
        </div>
        {kit.showOutro && (kit.signature || kit.handle) && (
          <div
            className="absolute inset-x-0 bottom-0 px-4 py-2 text-[10px]"
            style={{ background: kit.primaryColor, color: "#FFFFFF" }}
          >
            {kit.signature || kit.handle}
          </div>
        )}
      </div>
    </div>
  );
}
