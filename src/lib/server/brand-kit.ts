import "server-only";

import { eq } from "drizzle-orm";
import { dbReady } from "@/db";
import { brandKits } from "@/db/schema";
import {
  defaultBrandKit,
  normalizeBrandKit,
  type BrandKit,
  type BrandKitResponse,
} from "@/lib/brand-kit";

export async function getBrandKit(userId: string): Promise<BrandKitResponse> {
  const [row] = await (await dbReady())
    .select({
      data: brandKits.data,
      logoContentType: brandKits.logoContentType,
      logoUpdatedAt: brandKits.logoUpdatedAt,
    })
    .from(brandKits)
    .where(eq(brandKits.userId, userId))
    .limit(1);

  if (!row) {
    return { ...defaultBrandKit(), hasLogo: false, logoUpdatedAt: null };
  }
  return {
    ...normalizeBrandKit(row.data),
    hasLogo: Boolean(row.logoContentType),
    logoUpdatedAt: row.logoUpdatedAt ? row.logoUpdatedAt.toISOString() : null,
  };
}

async function rowExists(userId: string): Promise<boolean> {
  const [row] = await (await dbReady())
    .select({ userId: brandKits.userId })
    .from(brandKits)
    .where(eq(brandKits.userId, userId))
    .limit(1);
  return Boolean(row);
}

export async function saveBrandKit(
  userId: string,
  patch: Partial<BrandKit>
): Promise<BrandKitResponse> {
  const current = await getBrandKit(userId);
  const { hasLogo: _hasLogo, logoUpdatedAt: _logoUpdatedAt, ...currentKit } =
    current;
  const data = normalizeBrandKit({ ...currentKit, ...patch });
  const now = new Date();
  const db = await dbReady();

  if (await rowExists(userId)) {
    await db
      .update(brandKits)
      .set({ data, updatedAt: now })
      .where(eq(brandKits.userId, userId));
  } else {
    await db
      .insert(brandKits)
      .values({ userId, data, createdAt: now, updatedAt: now });
  }
  return getBrandKit(userId);
}

export async function getBrandLogo(
  userId: string
): Promise<{ bytes: Buffer; contentType: string; updatedAt: Date | null } | null> {
  const [row] = await (await dbReady())
    .select({
      bytes: brandKits.logoBytes,
      contentType: brandKits.logoContentType,
      updatedAt: brandKits.logoUpdatedAt,
    })
    .from(brandKits)
    .where(eq(brandKits.userId, userId))
    .limit(1);
  if (!row?.bytes || !row.contentType) return null;
  return {
    bytes: Buffer.from(row.bytes),
    contentType: row.contentType,
    updatedAt: row.updatedAt ?? null,
  };
}

export async function setBrandLogo(
  userId: string,
  logo: { bytes: Buffer; contentType: string } | null
): Promise<BrandKitResponse> {
  const now = new Date();
  const db = await dbReady();
  const values = {
    logoBytes: logo?.bytes ?? null,
    logoContentType: logo?.contentType ?? null,
    logoUpdatedAt: logo ? now : null,
    updatedAt: now,
  };

  if (await rowExists(userId)) {
    await db.update(brandKits).set(values).where(eq(brandKits.userId, userId));
  } else {
    await db.insert(brandKits).values({
      userId,
      data: defaultBrandKit(),
      createdAt: now,
      ...values,
    });
  }
  return getBrandKit(userId);
}
