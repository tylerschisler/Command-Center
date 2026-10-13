import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { pruneProtectedCopies } from "@/server/security/protected-copy-policy";

const tempDirectories: string[] = [];
afterEach(() => tempDirectories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));

describe("protected copy retention", () => {
  it("keeps only the newest bounded encrypted rollback copies", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "command-center-protected-copy-"));
    tempDirectories.push(directory);
    const databasePath = path.join(directory, "command-center.db");
    const copies = Array.from({ length: 5 }, (_, index) => {
      const copy = `${databasePath}.pre-restore-${index}.db`;
      fs.writeFileSync(copy, `encrypted-${index}`);
      fs.utimesSync(copy, index + 1, index + 1);
      return copy;
    });

    expect(pruneProtectedCopies(databasePath, "pre-restore", 3)).toEqual([copies[1], copies[0]]);
    expect(copies.map((copy) => fs.existsSync(copy))).toEqual([false, false, true, true, true]);
  });
});
