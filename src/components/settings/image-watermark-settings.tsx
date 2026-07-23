"use client";

import { useEffect, useRef, useState } from "react";
import { useAiStore } from "@/stores";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  applyImageWatermark,
  DEFAULT_IMAGE_WATERMARK_OPACITY,
  DEFAULT_IMAGE_WATERMARK_TEXT,
  IMAGE_WATERMARK_POSITIONS,
  type ImageWatermarkSettings,
} from "@/lib/image-watermark";
import { persistContentPrefsToProfile } from "@/lib/persist-content-prefs";

function buildPreviewDataUrl(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 360;
  canvas.height = 240;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#1e3a5f");
  gradient.addColorStop(0.5, "#4a6fa5");
  gradient.addColorStop(1, "#e8eef5");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillText("Sample post image", 24, 48);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText("Chart area · infographic · photo", 24, 80);

  return canvas.toDataURL("image/png");
}

export function ImageWatermarkSettings() {
  const enabled = useAiStore((s) => s.imageWatermarkEnabled);
  const text = useAiStore((s) => s.imageWatermarkText);
  const opacity = useAiStore((s) => s.imageWatermarkOpacity);
  const position = useAiStore((s) => s.imageWatermarkPosition);
  const setEnabled = useAiStore((s) => s.setImageWatermarkEnabled);
  const setText = useAiStore((s) => s.setImageWatermarkText);
  const setOpacity = useAiStore((s) => s.setImageWatermarkOpacity);
  const setPosition = useAiStore((s) => s.setImageWatermarkPosition);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewBaseRef = useRef<string | null>(null);
  const skipPersistOnceRef = useRef(true);

  useEffect(() => {
    if (!previewBaseRef.current) {
      previewBaseRef.current = buildPreviewDataUrl();
    }

    const base = previewBaseRef.current;
    if (!base) return;

    const settings: ImageWatermarkSettings = {
      enabled,
      text,
      opacity,
      position,
    };

    if (!enabled || !text.trim()) {
      setPreviewUrl(base);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      applyImageWatermark(base, settings)
        .then((url) => {
          if (!cancelled) setPreviewUrl(url);
        })
        .catch(() => {
          if (!cancelled) setPreviewUrl(base);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, text, opacity, position]);

  useEffect(() => {
    if (skipPersistOnceRef.current) {
      skipPersistOnceRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void persistContentPrefsToProfile().catch(() => {
        /* local store still holds the latest values */
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [enabled, text, opacity, position]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-1">
          <Label htmlFor="watermark-enabled">Apply signature to images</Label>
          <p className="text-xs text-muted-foreground">
            Adds your text as a subtle filigrane when images are generated or
            scheduled — no AI, drawn directly on the image.
          </p>
        </div>
        <Switch
          id="watermark-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="watermark-text">Signature text</Label>
        <Input
          id="watermark-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={DEFAULT_IMAGE_WATERMARK_TEXT}
          disabled={!enabled}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="watermark-opacity">
            Transparency ({Math.round(opacity * 100)}%)
          </Label>
          <input
            id="watermark-opacity"
            type="range"
            min={10}
            max={60}
            step={2}
            value={Math.round(opacity * 100)}
            disabled={!enabled}
            onChange={(e) => setOpacity(Number(e.target.value) / 100)}
            className="w-full accent-primary"
          />
          <p className="text-xs text-muted-foreground">
            Lower = more subtle. Default {Math.round(DEFAULT_IMAGE_WATERMARK_OPACITY * 100)}%.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Position</Label>
          <Select
            value={position}
            onValueChange={(v) =>
              setPosition(
                v as ImageWatermarkSettings["position"]
              )
            }
            disabled={!enabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_WATERMARK_POSITIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {previewUrl && (
        <div className="space-y-2">
          <Label>Preview</Label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Watermark preview"
            className="w-full max-w-sm rounded-lg border object-cover"
          />
        </div>
      )}
    </div>
  );
}
