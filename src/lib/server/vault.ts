import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  secretKindValues,
  userSecrets,
  type SecretKind,
} from "@/db/schema";
import { allowEnvKeyFallback } from "@/lib/env-flags";

export { allowEnvKeyFallback };

const ALGORITHM = "aes-256-gcm";

function masterKeyBytes(): Buffer {
  const raw = process.env.VAULT_MASTER_KEY?.trim();
  if (!raw) {
    throw new VaultConfigError(
      "VAULT_MASTER_KEY is missing. Add a 64-character hex key to .env (openssl rand -hex 32)."
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const b64 = Buffer.from(raw, "base64");
  if (b64.length === 32) return b64;
  throw new VaultConfigError(
    "VAULT_MASTER_KEY must be 32 bytes (64 hex chars or base64)."
  );
}

export class VaultConfigError extends Error {
  status = 503;
  constructor(message: string) {
    super(message);
    this.name = "VaultConfigError";
  }
}

export function isSecretKind(value: string): value is SecretKind {
  return (secretKindValues as readonly string[]).includes(value);
}

export function encryptSecret(plaintext: string): {
  ciphertext: string;
  iv: string;
  authTag: string;
} {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, masterKeyBytes(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptSecret(params: {
  ciphertext: string;
  iv: string;
  authTag: string;
}): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    masterKeyBytes(),
    Buffer.from(params.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(params.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(params.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function keyHint(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return "••••";
  return trimmed.slice(-4);
}

export type VaultStatus = {
  hasZernio: boolean;
  hasOpenai: boolean;
  hasFal: boolean;
  zernioHint: string | null;
  openaiHint: string | null;
  falHint: string | null;
};

export async function getVaultStatus(userId: string): Promise<VaultStatus> {
  const rows = await getDb()
    .select({
      kind: userSecrets.kind,
      keyHint: userSecrets.keyHint,
    })
    .from(userSecrets)
    .where(eq(userSecrets.userId, userId));

  const byKind = Object.fromEntries(rows.map((r) => [r.kind, r.keyHint])) as Partial<
    Record<SecretKind, string>
  >;

  return {
    hasZernio: Boolean(byKind.zernio),
    hasOpenai: Boolean(byKind.openai),
    hasFal: Boolean(byKind.fal),
    zernioHint: byKind.zernio ?? null,
    openaiHint: byKind.openai ?? null,
    falHint: byKind.fal ?? null,
  };
}

export async function getUserSecret(
  userId: string,
  kind: SecretKind
): Promise<string | null> {
  const [row] = await getDb()
    .select()
    .from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.kind, kind)))
    .limit(1);

  if (!row) return null;
  return decryptSecret({
    ciphertext: row.ciphertext,
    iv: row.iv,
    authTag: row.authTag,
  });
}

export async function upsertUserSecret(
  userId: string,
  kind: SecretKind,
  plaintext: string
): Promise<void> {
  const trimmed = plaintext.trim();
  if (!trimmed) {
    throw new Error("Secret cannot be empty");
  }
  const encrypted = encryptSecret(trimmed);
  const now = new Date();
  const existing = await getDb()
    .select({ id: userSecrets.id })
    .from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.kind, kind)))
    .limit(1);

  if (existing[0]) {
    await getDb()
      .update(userSecrets)
      .set({
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        keyHint: keyHint(trimmed),
        updatedAt: now,
      })
      .where(eq(userSecrets.id, existing[0].id));
    return;
  }

  await getDb().insert(userSecrets).values({
    id: randomUUID(),
    userId,
    kind,
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    keyHint: keyHint(trimmed),
    createdAt: now,
    updatedAt: now,
  });
}

export async function deleteUserSecret(
  userId: string,
  kind: SecretKind
): Promise<boolean> {
  const result = await getDb()
    .delete(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.kind, kind)))
    .returning({ id: userSecrets.id });
  return result.length > 0;
}
