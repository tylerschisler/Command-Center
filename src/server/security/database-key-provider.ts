import { randomBytes } from "node:crypto";
import { Entry } from "@napi-rs/keyring";

const KEY_LENGTH = 32;
const KEYCHAIN_SERVICE = "com.tylerschisler.command-center";
const KEYCHAIN_ACCOUNT = "database-encryption-key-v1";

export interface DatabaseKeyProvider {
  getOrCreateKey(): Buffer;
}

export interface DatabaseKeyStore extends DatabaseKeyProvider {
  getKey(): Buffer | null;
  setKey(key: Buffer): void;
  deleteKey(): boolean;
}

function assertValidKey(key: Buffer): Buffer {
  if (key.length !== KEY_LENGTH) throw new Error("The database encryption key is invalid.");
  return Buffer.from(key);
}

export class MacOsKeychainKeyProvider implements DatabaseKeyStore {
  private getEntry(): Entry {
    if (process.platform !== "darwin") throw new Error("Production database key storage currently requires macOS Keychain.");
    return new Entry(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  }

  getKey(): Buffer | null {
    const existing = this.getEntry().getSecret();
    if (existing) return assertValidKey(Buffer.from(existing));
    return null;
  }

  setKey(key: Buffer): void {
    const keyCopy = assertValidKey(key);
    try {
      this.getEntry().setSecret(keyCopy);
    } finally {
      keyCopy.fill(0);
    }
  }

  deleteKey(): boolean {
    return this.getEntry().deleteCredential();
  }

  getOrCreateKey(): Buffer {
    const existing = this.getKey();
    if (existing) return existing;

    const generated = randomBytes(KEY_LENGTH);
    try {
      this.setKey(generated);
      return Buffer.from(generated);
    } finally {
      generated.fill(0);
    }
  }
}

export class StaticDatabaseKeyProvider implements DatabaseKeyStore {
  private storedKey: Buffer | null;

  constructor(key: Buffer) {
    assertValidKey(key);
    this.storedKey = Buffer.from(key);
  }

  getKey(): Buffer | null {
    return this.storedKey ? Buffer.from(this.storedKey) : null;
  }

  setKey(key: Buffer): void {
    this.storedKey?.fill(0);
    this.storedKey = assertValidKey(key);
  }

  deleteKey(): boolean {
    if (!this.storedKey) return false;
    this.storedKey.fill(0);
    this.storedKey = null;
    return true;
  }

  getOrCreateKey(): Buffer {
    const existing = this.getKey();
    if (existing) return existing;
    const generated = randomBytes(KEY_LENGTH);
    this.setKey(generated);
    generated.fill(0);
    return this.getKey()!;
  }
}

export function getDefaultDatabaseKeyProvider(): DatabaseKeyProvider {
  const testKey = process.env.COMMAND_CENTER_TEST_DATABASE_KEY_HEX;
  if (testKey && process.env.NODE_ENV !== "production") {
    return new StaticDatabaseKeyProvider(Buffer.from(testKey, "hex"));
  }
  return new MacOsKeychainKeyProvider();
}
