import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .map((path) => path.replaceAll("\\", "/"));

const forbiddenPaths = [
  /(^|\/)SKILL\.md$/i,
  /(^|\/)(?:metadata\.)?(?:db|sqlite|sqlite3)(?:-(?:wal|shm|journal))?$/i,
  /\.(?:db|sqlite|sqlite3|log)$/i,
  /(^|\/)(?:\.skill-studio-pro|trash\/(?:skills|manifests)|staging\/(?:scan|import|publish|restore)|logs)(?:\/|$)/i,
  /(^|\/)\.(?:codex|claude|cursor|gemini)(?:\/|$)/i,
  /(^|\/)\.codeium\/windsurf(?:\/|$)/i,
  /(^|\/)(?:\.env(?:\..*)?|credentials?\.json|secrets?\.json)$/i,
];

const forbidden = tracked.filter((path) => forbiddenPaths.some((pattern) => pattern.test(path)));
if (forbidden.length) {
  throw new Error(`Tracked runtime/user data is forbidden:\n${forbidden.join("\n")}`);
}

const secretPatterns = [
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g,
  /\bglpat-[A-Za-z0-9_-]{16,}\b/g,
  /\bsk-(?:proj-|cp-)?[A-Za-z0-9_-]{16,}\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /\bBearer\s+[A-Za-z0-9._~+\-/=]{16,}\b/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
];
const findings = [];
for (const path of tracked) {
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  for (const pattern of secretPatterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const value = match[0];
      if (/fictional|example|redacted/i.test(value)) continue;
      const line = content.slice(0, match.index).split("\n").length;
      findings.push(`${path}:${line}:${value.slice(0, 12)}…`);
    }
  }
}
if (findings.length) {
  throw new Error(`High-confidence secret patterns found:\n${findings.join("\n")}`);
}

console.log(`Repository hygiene passed for ${tracked.length} tracked or unignored candidate files.`);
