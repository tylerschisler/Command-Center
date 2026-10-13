import fs from "node:fs";
import path from "node:path";

export type ProtectedCopyKind = "pre-encryption" | "pre-restore";

export function pruneProtectedCopies(databasePath: string, kind: ProtectedCopyKind, keep = 3): string[] {
  if (!Number.isInteger(keep) || keep < 1) throw new Error("Protected-copy retention must keep at least one copy.");
  const activePath = path.resolve(databasePath);
  const directory = path.dirname(activePath);
  if (!fs.existsSync(directory)) return [];
  const prefix = `${path.basename(activePath)}.${kind}-`;
  const candidates = fs.readdirSync(directory)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".db"))
    .map((name) => {
      const resolved = path.join(directory, name);
      const encodedTimestamp = Number(name.split(`.${kind}-`).at(-1)?.split("-", 1)[0]);
      return { resolved, created: Number.isFinite(encodedTimestamp) ? encodedTimestamp : fs.statSync(resolved).ctimeMs };
    })
    .sort((left, right) => right.created - left.created);

  const removed: string[] = [];
  for (const candidate of candidates.slice(keep)) {
    fs.rmSync(candidate.resolved);
    for (const suffix of ["-wal", "-shm"]) {
      const sidecar = `${candidate.resolved}${suffix}`;
      if (fs.existsSync(sidecar)) fs.rmSync(sidecar);
    }
    removed.push(candidate.resolved);
  }
  return removed;
}
