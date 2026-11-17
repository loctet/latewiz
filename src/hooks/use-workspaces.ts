import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
import { useAppStore } from "@/stores";

export type Workspace = {
  id: string;
  name: string;
  isActive: boolean;
  topic: string;
  language: string;
  zernioHint: string | null;
  hasOpenai: boolean;
  hasFal: boolean;
  createdAt: string;
};

export const workspaceKeys = {
  all: ["workspaces"] as const,
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

/**
 * After the active workspace changes, every cached Zernio query, the unlocked
 * key and the selected Zernio profile belong to the old workspace. A full
 * reload re-runs SessionBootstrap and starts clean.
 */
export function reloadIntoWorkspace(path?: string) {
  useAppStore.getState().setDefaultProfileId(null);
  if (path) window.location.assign(path);
  else window.location.reload();
}

export function useWorkspaces() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: workspaceKeys.all,
    queryFn: () => api<{ workspaces: Workspace[] }>("/api/workspaces"),
    enabled: !!session?.user,
    select: (data) => data.workspaces,
  });
}

export function useActivateWorkspace() {
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/workspaces/${encodeURIComponent(id)}/activate`, { method: "POST" }),
    onSuccess: () => reloadIntoWorkspace(),
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      sourceId?: string | null;
      zernioKey?: string;
      activate?: boolean;
    }) =>
      api<{ workspace: Workspace }>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    // Callers decide where to go when the new workspace became active.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}

export function useRenameWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api(`/api/workspaces/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; wasActive: boolean }) =>
      api(`/api/workspaces/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: (_data, { wasActive }) => {
      if (wasActive) {
        reloadIntoWorkspace();
        return;
      }
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}
