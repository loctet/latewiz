"use client";

import { useRouter } from "next/navigation";
import { useAiStore } from "@/stores";
import { savePostPrefill } from "@/lib/post-prefill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageIcon, PenLine, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function GeneratedMediaPage() {
  const router = useRouter();
  const { generatedMedia, removeGeneratedMedia, clearGeneratedMedia } =
    useAiStore();

  const useInPost = (url: string, digest: string) => {
    savePostPrefill({
      body: digest ? `Caption idea: ${digest}` : "",
      imageUrls: [url],
    });
    router.push("/dashboard/compose");
    toast.success("Opened in composer");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-primary" />
            Generated Media
          </h1>
          <p className="text-muted-foreground mt-1">
            AI images saved on this device. Generate more in{" "}
            <Link href="/dashboard/ai-studio" className="underline">
              AI Studio
            </Link>
            .
          </p>
        </div>
        {generatedMedia.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearGeneratedMedia}>
            Clear all
          </Button>
        )}
      </div>

      {generatedMedia.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ImageIcon className="mx-auto h-10 w-10 opacity-40 mb-3" />
            <p>No generated images yet.</p>
            <Button className="mt-4" asChild>
              <Link href="/dashboard/ai-studio">Go to AI Studio</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {generatedMedia.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-normal text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt=""
                  className="aspect-square w-full rounded-lg object-cover bg-muted"
                />
                {item.captionDigest && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.captionDigest}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => useInPost(item.url, item.captionDigest)}
                  >
                    <PenLine className="mr-2 h-3 w-3" />
                    Use in post
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeGeneratedMedia(item.id)}
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
