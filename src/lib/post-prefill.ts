export const NEW_POST_PREFILL_STORAGE_KEY = "latewiz_new_post_prefill";

export interface PostPrefill {
  title?: string;
  body: string;
  aiHint?: string;
  imageUrls?: string[];
}

export function savePostPrefill(prefill: PostPrefill): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(NEW_POST_PREFILL_STORAGE_KEY, JSON.stringify(prefill));
}

export function readPostPrefill(): PostPrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(NEW_POST_PREFILL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PostPrefill;
    if (!parsed.body && !parsed.title) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPostPrefill(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(NEW_POST_PREFILL_STORAGE_KEY);
}
