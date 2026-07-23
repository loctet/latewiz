import { useAiStore } from "@/stores/ai-store";

/** Sync current content prefs (templates, styles, watermark) to the user profile. */
export async function persistContentPrefsToProfile(): Promise<void> {
  const contentPrefs = useAiStore.getState().getContentPrefs();
  const res = await fetch("/api/me/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentPrefs }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data as { error?: string }).error || "Failed to sync content settings"
    );
  }
}
