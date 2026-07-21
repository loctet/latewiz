import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ScheduledCampaign,
  ScheduledCampaignInput,
  ScheduledCampaignRunResult,
} from "@/lib/scheduled-campaigns";

export const scheduledCampaignKeys = {
  all: ["scheduled-campaigns"] as const,
  lists: () => ["scheduled-campaigns", "list"] as const,
  detail: (id: string) => ["scheduled-campaigns", "detail", id] as const,
};

export function useScheduledCampaigns() {
  return useQuery({
    queryKey: scheduledCampaignKeys.lists(),
    queryFn: async () => {
      const res = await fetch("/api/campaigns");
      if (!res.ok) throw new Error("Failed to load scheduled campaigns");
      return (await res.json()) as { campaigns: ScheduledCampaign[] };
    },
  });
}

export function useSaveScheduledCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduledCampaignInput) => {
      const hasId = Boolean(input.id);
      const res = await fetch(
        hasId ? `/api/campaigns/${input.id}` : "/api/campaigns",
        {
          method: hasId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ??
            "Failed to save scheduled campaign"
        );
      }
      return (await res.json()) as { campaign: ScheduledCampaign };
    },
    onSuccess: ({ campaign }) => {
      queryClient.invalidateQueries({ queryKey: scheduledCampaignKeys.lists() });
      queryClient.setQueryData(scheduledCampaignKeys.detail(campaign.id), {
        campaign,
      });
    },
  });
}

export function useDeleteScheduledCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ??
            "Failed to delete scheduled campaign"
        );
      }
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: scheduledCampaignKeys.lists() });
      queryClient.removeQueries({ queryKey: scheduledCampaignKeys.detail(id) });
    },
  });
}

export function useRunScheduledCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/campaigns/${id}/run`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? "Failed to run campaign"
        );
      }
      return (await res.json()) as { result: ScheduledCampaignRunResult };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduledCampaignKeys.lists() });
    },
  });
}
