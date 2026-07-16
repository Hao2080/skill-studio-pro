import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedVersion = "0.1.0-beta.1";
const expectedRepository = "https://github.com/Hao2080/skill-studio-pro";
const read = (path) => readFileSync(resolve(root, path), "utf8");
const json = (path) => JSON.parse(read(path));

const packageJson = json("package.json");
const packageLock = json("package-lock.json");
const tauri = json("src-tauri/tauri.conf.json");
const cargoToml = read("src-tauri/Cargo.toml");
const cargoLock = read("src-tauri/Cargo.lock");

const failures = [];
const requireCondition = (condition, message) => { if (!condition) failures.push(message); };
const cargoVersion = cargoToml.match(/^version = "([^"]+)"/m)?.[1];
const cargoRepository = cargoToml.match(/^repository = "([^"]+)"/m)?.[1];
const cargoLockVersion = cargoLock.match(/\[\[package\]\]\r?\nname = "skill-studio-pro"\r?\nversion = "([^"]+)"/)?.[1];

requireCondition(packageJson.version === expectedVersion, "package.json version drift");
requireCondition(packageLock.version === expectedVersion && packageLock.packages?.[""]?.version === expectedVersion, "package-lock.json version drift");
requireCondition(cargoVersion === expectedVersion, "Cargo.toml version drift");
requireCondition(cargoLockVersion === expectedVersion, "Cargo.lock version drift");
requireCondition(tauri.version === expectedVersion, "tauri.conf.json version drift");
requireCondition(packageJson.repository?.url === `git+${expectedRepository}.git`, "package repository URL drift");
requireCondition(cargoRepository === expectedRepository, "Cargo repository URL drift");
requireCondition(tauri.bundle?.createUpdaterArtifacts === false, "Tauri updater artifacts must stay disabled");
requireCondition(!read("package-lock.json").includes("plugin-updater"), "Frontend updater dependency must stay absent");
requireCondition(!cargoLock.includes("tauri-plugin-updater"), "Rust updater dependency must stay absent");

for (const path of ["README.md", "README_en.md", "SECURITY.md", "CONTRIBUTING.md", "docs/RELEASE.md", "docs/release-notes.md"]) {
  requireCondition(read(path).includes(expectedRepository), `${path} must link to the Pro repository`);
}

for (const path of ["README.md", "README_en.md", "SECURITY.md", "CONTRIBUTING.md", "docs/RELEASE.md", "docs/release-notes.md"]) {
  const text = read(path);
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    requireCondition(existsSync(resolve(root, dirname(path), target)), `${path} has a broken local link: ${target}`);
  }
}

try {
  const upstream = execFileSync("git", ["remote", "get-url", "upstream"], { cwd: root, encoding: "utf8" }).trim();
  requireCondition(upstream === "https://github.com/liu673/skill-studio.git", "upstream remote drift");
} catch {
  failures.push("upstream remote is missing");
}

try {
  const origin = execFileSync("git", ["remote", "get-url", "origin"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  requireCondition(
    origin === expectedRepository || origin === `${expectedRepository}.git` || origin === `git@github.com:Hao2080/skill-studio-pro.git`,
    "origin must point to the independent Pro repository",
  );
} catch {
  console.warn("origin is not configured yet; local release preparation remains verifiable before repository creation");
}

if (failures.length) throw new Error(`Release metadata verification failed:\n${failures.join("\n")}`);
console.log(`Release metadata verified for v${expectedVersion}; updater remains disabled.`);
