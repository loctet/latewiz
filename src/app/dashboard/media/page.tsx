"use client";

import { useRouter } from "next/navigation";
import { useDeleteGeneratedMedia, useGeneratedMediaList } from "@/hooks";
import { savePostPrefill } from "@/lib/post-prefill";
import { PageContainer } from "@/components/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageIcon, PenLine, Trash2, Loader2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function GeneratedMediaPage() {
  const router = useRouter();
  const { data: items = [], isLoading, refetch } = useGeneratedMediaList();
  const deleteMutation = useDeleteGeneratedMedia();

  const useInPost = (url: string, digest: string) => {
    savePostPrefill({
      body: digest ? `Caption idea: ${digest}` : "",
      imageUrls: [url],
    });
    router.push("/dashboard/compose");
    toast.success("Opened in composer");
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Image removed");
    } catch {
      toast.error("Could not delete image");
    }
  };

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-primary" />
            Generated Media
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            Saved to{" "}
            <code className="text-xs bg-muted px-1 rounded">
              public/uploads/generated/
            </code>
            . Generate more in{" "}
            <Link href="/dashboard/ai-studio" className="underline">
              AI Studio
            </Link>
            .
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
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
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {items.map((item) => (
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
                    onClick={() => handleDelete(item.id)}
                    disabled={deleteMutation.isPending}
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
    </PageContainer>
  );
}
