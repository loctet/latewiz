import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GeneratedMediaItem } from "@/lib/openai/types";

export const generatedMediaKeys = {
  all: ["generated-media"] as const,
};

export function useGeneratedMediaList() {
  return useQuery({
    queryKey: generatedMediaKeys.all,
    queryFn: async () => {
      const res = await fetch("/api/media/generated");
      if (!res.ok) throw new Error("Failed to load media");
      const data = (await res.json()) as { items: GeneratedMediaItem[] };
      return data.items;
    },
  });
}

export function useSaveGeneratedMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      imageUrl: string;
      captionDigest?: string;
    }) => {
      const res = await fetch("/api/media/generated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: params.imageUrl,
          caption_digest: params.captionDigest ?? "",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? "Failed to save image"
        );
      }
      return (await res.json()) as { item: GeneratedMediaItem };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: generatedMediaKeys.all });
    },
  });
}

export function useDeleteGeneratedMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/media/generated?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: generatedMediaKeys.all });
    },
  });
}
