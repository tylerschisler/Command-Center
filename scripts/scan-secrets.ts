import { execFileSync } from "node:child_process";
import fs from "node:fs";

const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const forbiddenFiles = tracked.filter((file) => file === ".env" || /\.(?:db|sqlite|sqlite3|ccbackup|ccrecovery|pem|key)$/i.test(file));
const secretPatterns = [
  { name: "OpenAI API key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { name: "recovery credential", pattern: /\bCCREC1\.[A-Za-z0-9_-]{20,}\b/g },
  { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];
const findings: string[] = forbiddenFiles.map((file) => `forbidden tracked file: ${file}`);
for (const file of tracked) {
  if (file === "package-lock.json" || !fs.existsSync(file) || fs.statSync(file).size > 2_000_000) continue;
  const content = fs.readFileSync(file, "utf8");
  for (const rule of secretPatterns) if (rule.pattern.test(content)) findings.push(`${rule.name}: ${file}`);
}
if (findings.length) { console.error(`Secret scan failed:\n${findings.join("\n")}`); process.exitCode = 1; }
else console.log(`Secret scan passed (${tracked.length} tracked files checked).`);
