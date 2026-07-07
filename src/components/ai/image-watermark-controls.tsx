"use client";

import Link from "next/link";
import { useAiStore } from "@/stores";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_IMAGE_WATERMARK_OPACITY,
  IMAGE_WATERMARK_POSITIONS,
  type ImageWatermarkSettings,
} from "@/lib/image-watermark";
import { Stamp } from "lucide-react";

interface ImageWatermarkControlsProps {
  /** Show button to stamp images that were generated before watermark was enabled */
  onApplyToExisting?: () => void;
  applyingToExisting?: boolean;
  existingImageCount?: number;
  className?: string;
}

export function ImageWatermarkControls({
  onApplyToExisting,
  applyingToExisting = false,
  existingImageCount = 0,
  className,
}: ImageWatermarkControlsProps) {
  const enabled = useAiStore((s) => s.imageWatermarkEnabled);
  const text = useAiStore((s) => s.imageWatermarkText);
  const opacity = useAiStore((s) => s.imageWatermarkOpacity);
  const position = useAiStore((s) => s.imageWatermarkPosition);
  const setEnabled = useAiStore((s) => s.setImageWatermarkEnabled);
  const setText = useAiStore((s) => s.setImageWatermarkText);
  const setOpacity = useAiStore((s) => s.setImageWatermarkOpacity);
  const setPosition = useAiStore((s) => s.setImageWatermarkPosition);

  const canApplyExisting =
    Boolean(onApplyToExisting) &&
    enabled &&
    text.trim().length > 0 &&
    existingImageCount > 0;

  return (
    <div
      className={`rounded-lg border border-dashed bg-muted/30 p-4 space-y-4 ${className ?? ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium flex items-center gap-2">
            <Stamp className="h-4 w-4 text-primary" />
            Image signature (filigrane)
          </p>
          <p className="text-xs text-muted-foreground">
            Overlays your text on existing images — no AI. Also configurable in{" "}
            <Link href="/dashboard/settings" className="underline">
              Settings
            </Link>
            .
          </p>
        </div>
        <Switch
          id="campaign-watermark-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label="Enable image signature"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="campaign-watermark-text" className="text-xs">
          Signature text
        </Label>
        <Input
          id="campaign-watermark-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. @YourBrand · yoursite.com"
          disabled={!enabled}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="campaign-watermark-opacity" className="text-xs">
            Transparency ({Math.round(opacity * 100)}%)
          </Label>
          <input
            id="campaign-watermark-opacity"
            type="range"
            min={10}
            max={60}
            step={2}
            value={Math.round(opacity * 100)}
            disabled={!enabled}
            onChange={(e) => setOpacity(Number(e.target.value) / 100)}
            className="w-full accent-primary"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Position</Label>
          <Select
            value={position}
            onValueChange={(v) =>
              setPosition(v as ImageWatermarkSettings["position"])
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

      {enabled && !text.trim() && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          Enter signature text above, then apply it to your generated images.
        </p>
      )}

      {enabled && text.trim() && (
        <p className="text-xs text-muted-foreground">
          {existingImageCount > 0
            ? "Use the button below to apply your signature to generated images."
            : "Generate images first, then apply your signature."}{" "}
          Default transparency is{" "}
          {Math.round(DEFAULT_IMAGE_WATERMARK_OPACITY * 100)}%.
        </p>
      )}

      {canApplyExisting && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onApplyToExisting}
          disabled={applyingToExisting}
        >
          {applyingToExisting
            ? "Applying signature…"
            : `Apply signature to ${existingImageCount} existing image${existingImageCount === 1 ? "" : "s"}`}
        </Button>
      )}
    </div>
  );
}
