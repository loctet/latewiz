import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userProfiles } from "@/db/schema";
import {
  defaultNicheProfile,
  type NicheProfile,
} from "@/lib/openai/types";
import {
  defaultContentPrefs,
  normalizeContentPrefs,
  type ContentPrefs,
} from "@/lib/content-prefs";

export type UserProfileRecord = {
  userId: string;
  niche: NicheProfile;
  contentPrefs: ContentPrefs;
  onboardingCompleted: boolean;
};

export async function getUserProfile(
  userId: string
): Promise<UserProfileRecord | null> {
  const [row] = await getDb()
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  if (!row) return null;
  return {
    userId: row.userId,
    niche: { ...defaultNicheProfile(), ...(row.niche ?? {}) },
    contentPrefs: normalizeContentPrefs(row.contentPrefs),
    onboardingCompleted: row.onboardingCompleted,
  };
}

export async function upsertUserProfile(
  userId: string,
  patch: {
    niche?: NicheProfile;
    contentPrefs?: Partial<ContentPrefs>;
    onboardingCompleted?: boolean;
  }
): Promise<UserProfileRecord> {
  const existing = await getUserProfile(userId);
  const now = new Date();
  const niche = patch.niche
    ? { ...defaultNicheProfile(), ...patch.niche }
    : existing?.niche ?? defaultNicheProfile();
  const contentPrefs = normalizeContentPrefs({
    ...(existing?.contentPrefs ?? defaultContentPrefs()),
    ...(patch.contentPrefs ?? {}),
  });
  const onboardingCompleted =
    patch.onboardingCompleted ?? existing?.onboardingCompleted ?? false;

  if (existing) {
    await getDb()
      .update(userProfiles)
      .set({
        niche,
        contentPrefs,
        onboardingCompleted,
        updatedAt: now,
      })
      .where(eq(userProfiles.userId, userId));
  } else {
    await getDb().insert(userProfiles).values({
      userId,
      niche,
      contentPrefs,
      onboardingCompleted,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { userId, niche, contentPrefs, onboardingCompleted };
}

export function isNicheConfigured(niche: NicheProfile): boolean {
  return niche.topic.trim().length > 0;
}
