"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useUploadMedia, type UploadedMedia } from "@/hooks";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface AiImageReferencePickerProps {
  value?: string | null;
  onChange: (url: string | undefined) => void;
  /** Post media that can be used as a reference without re-uploading */
  mediaSources?: UploadedMedia[];
  /** Existing slot/campaign image URL */
  existingImageUrl?: string | null;
  disabled?: boolean;
  /** Hide help text; tighter spacing */
  compact?: boolean;
}

export function AiImageReferencePicker({
  value,
  onChange,
  mediaSources = [],
  existingImageUrl,
  disabled,
  compact = false,
}: AiImageReferencePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadMedia();

  const imageMedia = mediaSources.filter((m) => m.type === "image");

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    try {
      const uploaded = await uploadMutation.mutateAsync(file);
      onChange(uploaded.url);
      toast.success("Reference image ready");
    } catch {
      toast.error("Failed to upload reference image");
    }
  };

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <Label className="text-xs text-muted-foreground">
        Reference image (optional)
      </Label>
      {!compact && (
        <p className="text-xs text-muted-foreground">
          Upload or pick an image to guide AI generation (style, layout, or
          subject).
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled || uploadMutation.isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploadMutation.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {uploadMutation.isPending ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <ImagePlus className="mr-2 h-3 w-3" />
          )}
          Upload reference
        </Button>

        {existingImageUrl && existingImageUrl !== value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(existingImageUrl)}
          >
            Use current image
          </Button>
        )}

        {imageMedia.map((m, i) =>
          m.url !== value ? (
            <Button
              key={m.url}
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onChange(m.url)}
            >
              {imageMedia.length > 1 ? `Use attached ${i + 1}` : "Use attached"}
            </Button>
          ) : null
        )}

        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(undefined)}
          >
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {value && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={value}
          alt="Reference for AI generation"
          className={
            compact
              ? "h-12 w-12 rounded-md border object-cover"
              : "h-20 w-20 rounded-md border object-cover"
          }
        />
      )}
    </div>
  );
}
