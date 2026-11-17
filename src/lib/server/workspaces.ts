import "server-only";

import { randomUUID } from "crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import { dbReady } from "@/db";
import {
  scheduledCampaigns,
  userProfiles,
  userSecrets,
  workspaces,
} from "@/db/schema";
import { defaultNicheProfile, type NicheProfile } from "@/lib/openai/types";
import {
  defaultContentPrefs,
  normalizeContentPrefs,
  type ContentPrefs,
} from "@/lib/content-prefs";
import type { ScheduledCampaign } from "@/lib/scheduled-campaigns";

/**
 * A workspace bundles one key set (Zernio / OpenAI / fal) with one niche, so a
 * user can run several brands from one LateWiz login and switch between them.
 */
export type WorkspaceRecord = {
  id: string;
  userId: string;
  name: string;
  niche: NicheProfile;
  contentPrefs: ContentPrefs;
  isActive: boolean;
  createdAt: Date;
};

export class WorkspaceError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
    this.name = "WorkspaceError";
  }
}

type WorkspaceRow = typeof workspaces.$inferSelect;

function toRecord(row: WorkspaceRow): WorkspaceRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    niche: { ...defaultNicheProfile(), ...(row.niche ?? {}) },
    contentPrefs: normalizeContentPrefs(row.contentPrefs),
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

function defaultWorkspaceId(userId: string): string {
  return `default-${userId}`;
}

async function selectWorkspaces(userId: string): Promise<WorkspaceRow[]> {
  return (await dbReady())
    .select()
    .from(workspaces)
    .where(eq(workspaces.userId, userId))
    .orderBy(asc(workspaces.createdAt));
}

/**
 * Seed the first workspace from the pre-workspace data (user_profiles niche,
 * unscoped secrets, unscoped campaigns). Uses a deterministic id plus
 * ON CONFLICT DO NOTHING so parallel first requests cannot create two.
 */
async function seedDefaultWorkspace(userId: string): Promise<void> {
  const db = await dbReady();
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  const now = new Date();
  const id = defaultWorkspaceId(userId);
  const niche = { ...defaultNicheProfile(), ...(profile?.niche ?? {}) };

  await db
    .insert(workspaces)
    .values({
      id,
      userId,
      name: niche.topic.trim().slice(0, 60) || "Main",
      niche,
      contentPrefs: normalizeContentPrefs(
        profile?.contentPrefs ?? defaultContentPrefs()
      ),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  await db
    .update(userSecrets)
    .set({ workspaceId: id })
    .where(and(eq(userSecrets.userId, userId), isNull(userSecrets.workspaceId)));

  const campaigns = await db
    .select({ id: scheduledCampaigns.id, data: scheduledCampaigns.data })
    .from(scheduledCampaigns)
    .where(eq(scheduledCampaigns.userId, userId));
  for (const row of campaigns) {
    const data = row.data as ScheduledCampaign;
    if (data.workspaceId) continue;
    await db
      .update(scheduledCampaigns)
      .set({ data: { ...data, workspaceId: id } })
      .where(eq(scheduledCampaigns.id, row.id));
  }
}

/** All workspaces for a user (oldest first), creating the first one on demand. */
export async function listWorkspaces(userId: string): Promise<WorkspaceRecord[]> {
  let rows = await selectWorkspaces(userId);
  if (rows.length === 0) {
    await seedDefaultWorkspace(userId);
    rows = await selectWorkspaces(userId);
  }
  if (!rows.some((row) => row.isActive) && rows[0]) {
    await (await dbReady())
      .update(workspaces)
      .set({ isActive: true })
      .where(eq(workspaces.id, rows[0].id));
    rows[0] = { ...rows[0], isActive: true };
  }
  return rows.map(toRecord);
}

export async function getActiveWorkspace(userId: string): Promise<WorkspaceRecord> {
  const all = await listWorkspaces(userId);
  return all.find((w) => w.isActive) ?? all[0];
}

export async function getActiveWorkspaceId(userId: string): Promise<string> {
  return (await getActiveWorkspace(userId)).id;
}

async function requireOwnedWorkspace(
  userId: string,
  workspaceId: string
): Promise<WorkspaceRecord> {
  const all = await listWorkspaces(userId);
  const found = all.find((w) => w.id === workspaceId);
  if (!found) throw new WorkspaceError("Workspace not found", 404);
  return found;
}

export async function updateActiveWorkspaceProfile(
  userId: string,
  patch: { niche?: NicheProfile; contentPrefs?: ContentPrefs }
): Promise<WorkspaceRecord> {
  const active = await getActiveWorkspace(userId);
  const niche = patch.niche ?? active.niche;
  const contentPrefs = patch.contentPrefs ?? active.contentPrefs;
  await (await dbReady())
    .update(workspaces)
    .set({ niche, contentPrefs, updatedAt: new Date() })
    .where(eq(workspaces.id, active.id));
  return { ...active, niche, contentPrefs };
}

/**
 * Create a workspace. With `sourceId`, copies that workspace's niche, content
 * prefs and every stored key — the caller then swaps whichever key differs.
 */
export async function createWorkspace(
  userId: string,
  input: { name: string; sourceId?: string | null }
): Promise<WorkspaceRecord> {
  const name = input.name.trim().slice(0, 60);
  if (!name) throw new WorkspaceError("Name is required");

  const source = input.sourceId
    ? await requireOwnedWorkspace(userId, input.sourceId)
    : null;
  const db = await dbReady();
  const now = new Date();
  const id = randomUUID();

  await db.insert(workspaces).values({
    id,
    userId,
    name,
    niche: source?.niche ?? defaultNicheProfile(),
    contentPrefs: source?.contentPrefs ?? defaultContentPrefs(),
    isActive: false,
    createdAt: now,
    updatedAt: now,
  });

  if (source) {
    const secrets = await db
      .select()
      .from(userSecrets)
      .where(
        and(eq(userSecrets.userId, userId), eq(userSecrets.workspaceId, source.id))
      );
    for (const secret of secrets) {
      await db.insert(userSecrets).values({
        ...secret,
        id: randomUUID(),
        workspaceId: id,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return requireOwnedWorkspace(userId, id);
}

export async function renameWorkspace(
  userId: string,
  workspaceId: string,
  name: string
): Promise<WorkspaceRecord> {
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) throw new WorkspaceError("Name is required");
  await requireOwnedWorkspace(userId, workspaceId);
  await (await dbReady())
    .update(workspaces)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));
  return requireOwnedWorkspace(userId, workspaceId);
}

export async function activateWorkspace(
  userId: string,
  workspaceId: string
): Promise<WorkspaceRecord> {
  await requireOwnedWorkspace(userId, workspaceId);
  const db = await dbReady();
  await db
    .update(workspaces)
    .set({ isActive: false })
    .where(eq(workspaces.userId, userId));
  await db
    .update(workspaces)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));
  return requireOwnedWorkspace(userId, workspaceId);
}

/**
 * Delete a workspace with its stored keys and its scheduled campaigns.
 * The last workspace cannot be deleted.
 */
export async function deleteWorkspace(
  userId: string,
  workspaceId: string
): Promise<void> {
  const all = await listWorkspaces(userId);
  const target = all.find((w) => w.id === workspaceId);
  if (!target) throw new WorkspaceError("Workspace not found", 404);
  if (all.length <= 1) {
    throw new WorkspaceError("You need at least one workspace");
  }

  const db = await dbReady();
  await db
    .delete(userSecrets)
    .where(
      and(eq(userSecrets.userId, userId), eq(userSecrets.workspaceId, workspaceId))
    );

  const campaigns = await db
    .select({ id: scheduledCampaigns.id, data: scheduledCampaigns.data })
    .from(scheduledCampaigns)
    .where(eq(scheduledCampaigns.userId, userId));
  for (const row of campaigns) {
    if ((row.data as ScheduledCampaign).workspaceId === workspaceId) {
      await db.delete(scheduledCampaigns).where(eq(scheduledCampaigns.id, row.id));
    }
  }

  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));

  if (target.isActive) {
    const next = all.find((w) => w.id !== workspaceId);
    if (next) await activateWorkspace(userId, next.id);
  }
}
