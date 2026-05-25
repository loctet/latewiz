"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  useGeneratedMediaList,
  useUploadMedia,
  urlToFile,
  type UploadedMedia,
} from "@/hooks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderOpen, ImageIcon, Film, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaLibraryPickerProps {
  media: UploadedMedia[];
  onMediaChange: (media: UploadedMedia[]) => void;
  maxFiles?: number;
}

export function MediaLibraryPicker({
  media,
  onMediaChange,
  maxFiles = 10,
}: MediaLibraryPickerProps) {
  const [open, setOpen] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const { data: items = [], isLoading } = useGeneratedMediaList();
  const uploadMutation = useUploadMedia();

  const remaining = maxFiles - media.length;

  const handleSelect = async (item: (typeof items)[number]) => {
    if (remaining <= 0) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setSelectingId(item.id);
    try {
      const isVideo = item.type === "video";
      const file = await urlToFile(
        item.url,
        item.filename ??
          (isVideo ? `media-${item.id}.mp4` : `media-${item.id}.png`)
      );
      const uploaded = await uploadMutation.mutateAsync(file);
      onMediaChange([...media, uploaded]);
      toast.success(isVideo ? "Video added from library" : "Image added from library");
      setOpen(false);
    } catch {
      toast.error("Could not add image from library");
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={remaining <= 0 || uploadMutation.isPending}
        >
          <FolderOpen className="mr-2 h-4 w-4" />
          Choose from media library
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Media library</DialogTitle>
          <DialogDescription>
            Select generated images or videos from your library.{" "}
            {remaining > 0 ? (
              <span>
                You can add {remaining} more file{remaining === 1 ? "" : "s"}.
              </span>
            ) : (
              <span>Remove a file to add another.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <ImageIcon className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">No generated media in your library yet.</p>
            <Button className="mt-4" size="sm" asChild>
              <Link href="/dashboard/ai-studio" onClick={() => setOpen(false)}>
                Go to AI Studio
              </Link>
            </Button>
          </div>
        ) : (
          <ScrollArea className="max-h-[min(60vh,28rem)] pr-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((item) => {
                const isSelecting = selectingId === item.id;
                const disabled =
                  remaining <= 0 ||
                  uploadMutation.isPending ||
                  (selectingId !== null && !isSelecting);

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-lg border bg-muted text-left transition-colors",
                      "hover:border-primary hover:ring-2 hover:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      disabled && "pointer-events-none opacity-60"
                    )}
                  >
                    {item.type === "video" ? (
                      <video
                        src={item.url}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                    {item.type === "video" && (
                      <Film className="absolute left-2 top-2 h-4 w-4 text-white drop-shadow" />
                    )}
                    <div
                      className={cn(
                        "absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity",
                        "group-hover:opacity-100 group-focus-visible:opacity-100",
                        isSelecting && "opacity-100"
                      )}
                    >
                      {isSelecting ? (
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      ) : (
                        <Check className="h-6 w-6 text-white drop-shadow" />
                      )}
                    </div>
                    {item.captionDigest && (
                      <p className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-[10px] leading-tight text-white line-clamp-2">
                        {item.captionDigest}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
