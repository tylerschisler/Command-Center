import readline from "node:readline";
import { getEnvironment } from "../src/config/env";
import { MacOsKeychainKeyProvider } from "../src/server/security/database-key-provider";
import { RecoveryService } from "../src/server/services/recovery-service";

async function readCredential(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    const input = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: false });
    return await new Promise((resolve) => input.question(prompt, (answer) => {
      input.close();
      resolve(answer.trim());
    }));
  }

  process.stderr.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let value = "";
  return await new Promise((resolve, reject) => {
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stderr.write("\n");
    };
    const onData = (chunk: Buffer) => {
      for (const byte of chunk) {
        if (byte === 3) {
          cleanup();
          reject(new Error("Recovery operation cancelled."));
          return;
        }
        if (byte === 13 || byte === 10) {
          cleanup();
          resolve(value.trim());
          return;
        }
        if (byte === 127 || byte === 8) value = value.slice(0, -1);
        else if (byte >= 32 && byte <= 126) value += String.fromCharCode(byte);
      }
    };
    process.stdin.on("data", onData);
  });
}

const [operation, backupPath] = process.argv.slice(2);
const environment = getEnvironment();
const service = new RecoveryService({
  databasePath: environment.DATABASE_PATH,
  backupDirectory: environment.BACKUP_DIRECTORY,
  recoveryMaterialPath: environment.RECOVERY_MATERIAL_PATH,
  keyStore: new MacOsKeychainKeyProvider(),
});

if (operation === "init") {
  const result = service.initializeRecovery();
  console.log("Recovery initialized. Save this credential now; it will not be shown again:");
  console.log(result.credential);
  console.log(`Protected recovery material: ${result.recoveryMaterialPath}`);
} else if (operation === "verify") {
  service.verifyCredential(await readCredential("Recovery credential: "));
  console.log("Recovery credential verified.");
} else if (operation === "restore-keychain") {
  const credential = await readCredential("Recovery credential: ");
  if (backupPath) {
    const metadata = service.restoreKeychainFromBackup(backupPath, credential);
    console.log(`Keychain entry restored after authenticating backup ${metadata.backupId}.`);
  } else {
    service.restoreKeychain(credential);
    console.log("Keychain entry restored after verifying the active database.");
  }
} else if (operation === "rotate") {
  const result = service.rotateCredential(await readCredential("Current recovery credential: "));
  console.log("Recovery credential rotated. Replace the prior credential with this value:");
  console.log(result.credential);
} else {
  throw new Error("Usage: recovery.ts init | verify | restore-keychain [backup-path] | rotate");
}
