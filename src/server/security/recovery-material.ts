import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const CREDENTIAL_PREFIX = "CCREC1.";
const DATABASE_KEY_BYTES = 32;
const RECOVERY_SECRET_BYTES = 32;
const MAX_MATERIAL_BYTES = 64 * 1024;

export interface RecoveryKdfParameters {
  N: number;
  r: number;
  p: number;
}

export const DEFAULT_RECOVERY_KDF: RecoveryKdfParameters = {
  N: 1 << 17,
  r: 8,
  p: 1,
};

const metadataSchema = z.object({
  formatVersion: z.literal(1),
  createdAt: z.string().datetime(),
  wrappingCipher: z.literal("aes-256-gcm"),
  keyDerivation: z.literal("scrypt"),
  salt: z.string().base64(),
  nonce: z.string().base64(),
  N: z.number().int().min(1 << 10).max(1 << 20),
  r: z.number().int().min(1).max(32),
  p: z.number().int().min(1).max(16),
});

const envelopeSchema = z.object({
  metadata: metadataSchema,
  authenticationTag: z.string().base64(),
  wrappedDatabaseKey: z.string().base64(),
});

export type RecoveryMaterial = z.infer<typeof envelopeSchema>;

function parseRecoverySecret(credential: string): Buffer {
  const normalized = credential.trim();
  if (!normalized.startsWith(CREDENTIAL_PREFIX)) throw new Error("The recovery credential is invalid.");
  const encoded = normalized.slice(CREDENTIAL_PREFIX.length);
  if (!/^[A-Za-z0-9_-]{43}$/.test(encoded)) throw new Error("The recovery credential is invalid.");
  const secret = Buffer.from(encoded, "base64url");
  if (secret.length !== RECOVERY_SECRET_BYTES) throw new Error("The recovery credential is invalid.");
  return secret;
}

function deriveWrappingKey(secret: Buffer, salt: Buffer, parameters: RecoveryKdfParameters): Buffer {
  return Buffer.from(scryptSync(secret, salt, 32, {
    N: parameters.N,
    r: parameters.r,
    p: parameters.p,
    maxmem: Math.max(32 * 1024 * 1024, 128 * parameters.N * parameters.r + 2 * 1024 * 1024),
  }));
}

export function generateRecoveryCredential(): string {
  const secret = randomBytes(RECOVERY_SECRET_BYTES);
  try {
    return `${CREDENTIAL_PREFIX}${secret.toString("base64url")}`;
  } finally {
    secret.fill(0);
  }
}

export function createRecoveryMaterial(
  databaseKey: Buffer,
  credential: string,
  parameters: RecoveryKdfParameters = DEFAULT_RECOVERY_KDF,
): Buffer {
  if (databaseKey.length !== DATABASE_KEY_BYTES) throw new Error("The database encryption key is invalid.");
  const secret = parseRecoverySecret(credential);
  const salt = randomBytes(32);
  const nonce = randomBytes(12);
  const wrappingKey = deriveWrappingKey(secret, salt, parameters);
  try {
    const metadata = {
      formatVersion: 1 as const,
      createdAt: new Date().toISOString(),
      wrappingCipher: "aes-256-gcm" as const,
      keyDerivation: "scrypt" as const,
      salt: salt.toString("base64"),
      nonce: nonce.toString("base64"),
      N: parameters.N,
      r: parameters.r,
      p: parameters.p,
    };
    const metadataBytes = Buffer.from(JSON.stringify(metadata), "utf8");
    const cipher = createCipheriv("aes-256-gcm", wrappingKey, nonce);
    cipher.setAAD(metadataBytes);
    const wrappedDatabaseKey = Buffer.concat([cipher.update(databaseKey), cipher.final()]);
    return Buffer.from(JSON.stringify({
      metadata,
      authenticationTag: cipher.getAuthTag().toString("base64"),
      wrappedDatabaseKey: wrappedDatabaseKey.toString("base64"),
    }), "utf8");
  } finally {
    secret.fill(0);
    salt.fill(0);
    nonce.fill(0);
    wrappingKey.fill(0);
  }
}

export function unwrapRecoveryMaterial(contents: Buffer, credential: string): Buffer {
  let recoveredKey: Buffer | undefined;
  try {
    if (contents.length > MAX_MATERIAL_BYTES) throw new Error("invalid");
    const envelope = envelopeSchema.parse(JSON.parse(contents.toString("utf8")));
    const secret = parseRecoverySecret(credential);
    const salt = Buffer.from(envelope.metadata.salt, "base64");
    const wrappingKey = deriveWrappingKey(secret, salt, envelope.metadata);
    try {
      const decipher = createDecipheriv("aes-256-gcm", wrappingKey, Buffer.from(envelope.metadata.nonce, "base64"));
      decipher.setAAD(Buffer.from(JSON.stringify(envelope.metadata), "utf8"));
      decipher.setAuthTag(Buffer.from(envelope.authenticationTag, "base64"));
      recoveredKey = Buffer.concat([
        decipher.update(Buffer.from(envelope.wrappedDatabaseKey, "base64")),
        decipher.final(),
      ]);
      if (recoveredKey.length !== DATABASE_KEY_BYTES) throw new Error("invalid");
      return recoveredKey;
    } finally {
      secret.fill(0);
      salt.fill(0);
      wrappingKey.fill(0);
    }
  } catch {
    recoveredKey?.fill(0);
    throw new Error("The recovery credential or recovery material is invalid.");
  }
}

export function readRecoveryMaterial(materialPath: string): Buffer {
  const contents = fs.readFileSync(path.resolve(materialPath));
  if (contents.length > MAX_MATERIAL_BYTES) throw new Error("The recovery material is invalid.");
  return contents;
}

export function writeRecoveryMaterial(materialPath: string, contents: Buffer): void {
  const resolved = path.resolve(materialPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true, mode: 0o700 });
  const temporary = `${resolved}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporary, contents, { flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, resolved);
    fs.chmodSync(resolved, 0o600);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary);
  }
}
