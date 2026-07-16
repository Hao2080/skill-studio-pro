import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const expectedVersion = "0.1.0-beta.1";

const outputPaths = {
  frontend: "artifacts/sbom/frontend.cdx.json",
  rust: "artifacts/sbom/rust.cdx.json",
  combined: "artifacts/sbom/skill-studio-pro.cdx.json",
  licenses: "artifacts/THIRD-PARTY-LICENSES.json",
  notices: "docs/THIRD-PARTY-NOTICES.md",
};

const npmLicenseEvidence = [
  { prefix: "@esbuild/", version: "0.25.12", license: "MIT" },
  { prefix: "@rollup/rollup-", version: "4.60.0", license: "MIT" },
  { prefix: "@tauri-apps/cli-", version: "2.10.1", license: "Apache-2.0 OR MIT" },
  { name: "fsevents", version: "2.3.3", license: "MIT" },
];

const permittedLicenseTokens = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BSL-1.0",
  "BlueOak-1.0.0",
  "CC-BY-4.0",
  "CC0-1.0",
  "CDLA-Permissive-2.0",
  "ISC",
  "LGPL-2.1-or-later",
  "LLVM-exception",
  "MIT",
  "MIT-0",
  "MPL-2.0",
  "NCSA",
  "OpenSSL",
  "Unicode-3.0",
  "Unicode-DFS-2016",
  "Unlicense",
  "WTFPL",
  "Zlib",
]);

const assetInventory = [
  {
    name: "Skill Studio Pro mark and wordmark",
    paths: ["public/assets/brand/*.svg"],
    license: "Apache-2.0",
    provenance: "Original project artwork; no Apple or upstream logo asset is used as the Pro identity.",
    bundled: true,
  },
  {
    name: "Desktop and mobile application icons",
    paths: ["src-tauri/icons/**"],
    license: "Apache-2.0",
    provenance: "Generated from the original Skill Studio Pro mark.",
    bundled: true,
  },
  {
    name: "Upstream Skill Studio logo archive",
    paths: ["branding/upstream-logo-reference/**", "branding/upstream-screenshots-reference/**"],
    license: "Apache-2.0 (upstream project distribution)",
    provenance: "Logos and historical product screenshots preserved from liu673/skill-studio at cd0bb0af53865d4a9643968080bfc5a8137b72d9 for attribution and audit.",
    bundled: false,
  },
  {
    name: "Windows release UAT screenshot",
    paths: ["docs/assets/skill-studio-pro-windows.png"],
    license: "Apache-2.0",
    provenance: "Captured from the isolated Task 2 release application with fixture-only data.",
    bundled: false,
  },
  {
    name: "Fonts",
    paths: [],
    license: "Not applicable",
    provenance: "No font files are bundled; the UI uses platform system font fallbacks.",
    bundled: false,
  },
];

const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const normalizePath = (value) => value.replaceAll("\\", "/");

function packageNameFromLockPath(packagePath) {
  const normalized = normalizePath(packagePath);
  const marker = "node_modules/";
  const index = normalized.lastIndexOf(marker);
  if (index < 0) throw new Error(`Unsupported package-lock path: ${packagePath}`);
  return normalized.slice(index + marker.length);
}

function npmEvidence(name, version) {
  const evidence = npmLicenseEvidence.find(
    (item) => item.version === version && (item.name === name || (item.prefix && name.startsWith(item.prefix))),
  );
  if (!evidence) return null;
  return {
    license: evidence.license,
    source: `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`,
  };
}

function readNpmComponents() {
  const lock = readJson("package-lock.json");
  const rootPackage = lock.packages?.[""];
  if (lock.lockfileVersion !== 3 || rootPackage?.version !== expectedVersion) {
    throw new Error(`package-lock.json must be lockfile v3 for ${expectedVersion}`);
  }

  const licenses = [];
  const components = [];
  for (const [packagePath, lockEntry] of Object.entries(lock.packages)) {
    if (!packagePath) continue;
    const name = packageNameFromLockPath(packagePath);
    const version = lockEntry.version;
    const evidence = npmEvidence(name, version);
    // package-lock v3 is the cross-platform source of truth. Reading
    // node_modules here would make optional OS packages and repository fields
    // depend on the host that happened to run the generator.
    const declaredLicense = lockEntry.license ?? evidence?.license ?? null;
    const licenseSource = lockEntry.license ? "package-lock.json" : evidence?.source ?? "not-declared";
    const purl = `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
    const component = {
      type: "library",
      "bom-ref": purl,
      name,
      version,
      ...(declaredLicense ? { licenses: [{ expression: declaredLicense }] } : {}),
      ...(lockEntry.integrity?.startsWith("sha512-")
        ? { hashes: [{ alg: "SHA-512", content: Buffer.from(lockEntry.integrity.slice(7), "base64").toString("hex") }] }
        : {}),
      purl,
      scope: lockEntry.dev ? "excluded" : lockEntry.optional ? "optional" : "required",
      properties: [
        { name: "skill-studio-pro:ecosystem", value: "npm" },
        { name: "skill-studio-pro:license-source", value: licenseSource },
        { name: "skill-studio-pro:lock-path", value: normalizePath(packagePath) },
      ],
    };
    components.push(component);
    licenses.push({ ecosystem: "npm", name, version, license: declaredLicense, licenseSource, purl });
  }
  components.sort((left, right) => left["bom-ref"].localeCompare(right["bom-ref"]));
  licenses.sort((left, right) => left.purl.localeCompare(right.purl));
  return { components, licenses };
}

function readCargoLockChecksums() {
  const text = readFileSync(resolve(root, "src-tauri/Cargo.lock"), "utf8");
  const checksums = new Map();
  for (const block of text.split(/\r?\n\[\[package\]\]\r?\n/).slice(1)) {
    const name = block.match(/^name = "([^"]+)"/m)?.[1];
    const version = block.match(/^version = "([^"]+)"/m)?.[1];
    const checksum = block.match(/^checksum = "([0-9a-f]+)"/m)?.[1];
    if (name && version && checksum) checksums.set(`${name}@${version}`, checksum);
  }
  return checksums;
}

function readRustComponents() {
  const metadata = JSON.parse(execFileSync(
    "cargo",
    ["metadata", "--format-version", "1", "--locked", "--manifest-path", "src-tauri/Cargo.toml"],
    { cwd: root, encoding: "utf8", maxBuffer: 128 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] },
  ));
  const checksums = readCargoLockChecksums();
  const licenses = [];
  const components = [];
  const refByCargoId = new Map();
  const projectPackage = metadata.packages.find((item) => item.name === "skill-studio-pro" && item.source === null);
  if (!projectPackage || projectPackage.version !== expectedVersion) {
    throw new Error(`Cargo metadata must describe skill-studio-pro ${expectedVersion}`);
  }
  refByCargoId.set(projectPackage.id, `pkg:cargo/skill-studio-pro@${expectedVersion}`);

  for (const item of metadata.packages) {
    if (item.id === projectPackage.id) continue;
    const purl = `pkg:cargo/${encodeURIComponent(item.name)}@${encodeURIComponent(item.version)}`;
    const declaredLicense = item.license ?? null;
    const licenseSource = item.license
      ? "Cargo.toml via cargo metadata"
      : item.license_file
        ? "license-file declared by cargo metadata (SPDX expression not declared)"
        : "not-declared";
    const checksum = checksums.get(`${item.name}@${item.version}`);
    const component = {
      type: "library",
      "bom-ref": purl,
      name: item.name,
      version: item.version,
      ...(declaredLicense ? { licenses: [{ expression: declaredLicense }] } : {}),
      ...(checksum ? { hashes: [{ alg: "SHA-256", content: checksum }] } : {}),
      purl,
      ...(item.repository ? { externalReferences: [{ type: "vcs", url: item.repository }] } : {}),
      properties: [
        { name: "skill-studio-pro:ecosystem", value: "cargo" },
        { name: "skill-studio-pro:license-source", value: licenseSource },
      ],
    };
    components.push(component);
    licenses.push({ ecosystem: "cargo", name: item.name, version: item.version, license: declaredLicense, licenseSource, purl });
    refByCargoId.set(item.id, purl);
  }

  const dependencies = (metadata.resolve?.nodes ?? []).flatMap((node) => {
    const ref = refByCargoId.get(node.id);
    if (!ref) return [];
    const dependsOn = [...new Set(node.dependencies.map((id) => refByCargoId.get(id)).filter(Boolean))].sort();
    return [{ ref, dependsOn }];
  }).sort((left, right) => left.ref.localeCompare(right.ref));
  components.sort((left, right) => left["bom-ref"].localeCompare(right["bom-ref"]));
  licenses.sort((left, right) => left.purl.localeCompare(right.purl));
  return { components, dependencies, licenses };
}

function cyclonedxBom(components, dependencies = []) {
  return {
    $schema: "https://cyclonedx.org/schema/bom-1.6.schema.json",
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    version: 1,
    metadata: {
      component: {
        type: "application",
        "bom-ref": `pkg:github/Hao2080/skill-studio-pro@${expectedVersion}`,
        name: "skill-studio-pro",
        version: expectedVersion,
        licenses: [{ expression: "Apache-2.0" }],
        purl: `pkg:github/Hao2080/skill-studio-pro@${expectedVersion}`,
      },
      properties: [
        { name: "skill-studio-pro:reproducible", value: "true" },
        { name: "skill-studio-pro:lockfiles", value: "package-lock.json;src-tauri/Cargo.lock" },
      ],
    },
    components,
    ...(dependencies.length ? { dependencies } : {}),
  };
}

function licenseTokens(expression) {
  if (!expression) return [];
  return expression
    .replaceAll("(", " ")
    .replaceAll(")", " ")
    // Cargo manifests written before SPDX expressions were common often use
    // `MIT/Apache-2.0` as a legacy dual-license spelling. Preserve the source
    // expression in evidence while interpreting the slash as OR for policy.
    .replace(/\s*\/\s*/g, " OR ")
    .split(/\s+(?:AND|OR|WITH)\s+/i)
    .map((value) => value.trim())
    .filter(Boolean);
}

function evaluatePolicy(entries) {
  const blocked = [];
  const unknown = [];
  const review = [];
  for (const item of entries) {
    if (!item.license) {
      unknown.push({ ...item, reason: "No license expression declared by the package metadata" });
      continue;
    }
    if (/\b(?:AGPL|GPL|SSPL|BUSL|Commons-Clause)/i.test(item.license)) {
      blocked.push({ ...item, reason: "Strong copyleft or source-available license requires explicit legal approval" });
      continue;
    }
    const unrecognized = licenseTokens(item.license).filter((token) => !permittedLicenseTokens.has(token));
    if (unrecognized.length) {
      unknown.push({ ...item, reason: `Unrecognized license token(s): ${unrecognized.join(", ")}` });
      continue;
    }
    if (/(?:MPL-|LGPL-|EPL-|CDDL-|CC-BY-)/i.test(item.license)) {
      review.push({ ...item, reason: "Notice, attribution, or file-level copyleft obligations apply" });
    }
  }
  return { status: blocked.length || unknown.length ? "FAIL" : "PASS", blocked, unknown, review };
}

function markdownNotices(entries, policy) {
  const escapeCell = (value) => String(value ?? "NOT DECLARED").replaceAll("|", "\\|");
  const distribution = Object.entries(Object.groupBy(entries, (item) => item.license ?? "NOT DECLARED"))
    .map(([license, items]) => ({ license, count: items.length }))
    .sort((left, right) => left.license.localeCompare(right.license));
  const lines = [
    "# Third-Party Dependencies and Assets",
    "",
    `Generated deterministically from \`package-lock.json\`, \`src-tauri/Cargo.lock\`, and package manifests for Skill Studio Pro ${expectedVersion}.`,
    "The declared expressions below are evidence, not a substitute for legal advice.",
    "",
    "## License policy result",
    "",
    `- Policy: **${policy.status}**`,
    `- Dependency records: **${entries.length}**`,
    `- Blocked strong-copyleft/source-available records: **${policy.blocked.length}**`,
    `- Unknown or undeclared records: **${policy.unknown.length}**`,
    `- Notice/attribution/file-level review records: **${policy.review.length}**`,
    "",
    "No dependency is silently assigned a guessed license. Optional npm platform packages that are absent on the generating OS use pinned npm registry metadata evidence recorded in the generator.",
    "",
    "## License distribution",
    "",
    "| Declared expression | Count |",
    "|---|---:|",
    ...distribution.map((item) => `| ${escapeCell(item.license)} | ${item.count} |`),
    "",
    "## Items requiring notice or file-level review",
    "",
    ...(policy.review.length
      ? ["| Ecosystem | Package | Version | License | Reason |", "|---|---|---|---|---|", ...policy.review.map((item) => `| ${item.ecosystem} | ${escapeCell(item.name)} | ${item.version} | ${escapeCell(item.license)} | ${escapeCell(item.reason)} |`)]
      : ["None."]),
    "",
    "## Fonts, icons, brands, and screenshots",
    "",
    "| Asset | Paths | Bundled | License | Provenance |",
    "|---|---|---:|---|---|",
    ...assetInventory.map((item) => `| ${escapeCell(item.name)} | ${escapeCell(item.paths.join(", ") || "None")} | ${item.bundled ? "Yes" : "No"} | ${escapeCell(item.license)} | ${escapeCell(item.provenance)} |`),
    "",
    "## Complete dependency inventory",
    "",
    "| Ecosystem | Package | Version | Declared license | Evidence |",
    "|---|---|---|---|---|",
    ...entries.map((item) => `| ${item.ecosystem} | ${escapeCell(item.name)} | ${item.version} | ${escapeCell(item.license)} | ${escapeCell(item.licenseSource)} |`),
  ];
  return lines.join("\n");
}

function validateBom(value, label) {
  if (value.bomFormat !== "CycloneDX" || value.specVersion !== "1.6" || !Array.isArray(value.components)) {
    throw new Error(`${label} is not a CycloneDX 1.6 component BOM`);
  }
  const refs = new Set();
  for (const component of value.components) {
    if (!component["bom-ref"] || !component.name || !component.version || refs.has(component["bom-ref"])) {
      throw new Error(`${label} contains an invalid or duplicate component reference`);
    }
    refs.add(component["bom-ref"]);
  }
}

function emit(path, content) {
  const absolute = resolve(root, path);
  if (checkOnly) {
    if (!existsSync(absolute) || readFileSync(absolute, "utf8") !== content) {
      throw new Error(`${path} is stale; run npm run sbom:generate`);
    }
    return;
  }
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

const npm = readNpmComponents();
const rust = readRustComponents();
const allLicenses = [...npm.licenses, ...rust.licenses].sort((left, right) => left.purl.localeCompare(right.purl));
const policy = evaluatePolicy(allLicenses);
const frontendBom = cyclonedxBom(npm.components);
const rustBom = cyclonedxBom(rust.components, rust.dependencies);
const combinedBom = cyclonedxBom([...npm.components, ...rust.components].sort((left, right) => left["bom-ref"].localeCompare(right["bom-ref"])), rust.dependencies);
validateBom(frontendBom, "frontend SBOM");
validateBom(rustBom, "Rust SBOM");
validateBom(combinedBom, "combined SBOM");

const licenseReport = {
  schemaVersion: 1,
  project: { name: "skill-studio-pro", version: expectedVersion, license: "Apache-2.0" },
  generatedFrom: ["package-lock.json", "src-tauri/Cargo.lock", "package manifests"],
  reproducible: true,
  policy,
  assets: assetInventory,
  dependencies: allLicenses,
};

emit(outputPaths.frontend, jsonText(frontendBom));
emit(outputPaths.rust, jsonText(rustBom));
emit(outputPaths.combined, jsonText(combinedBom));
emit(outputPaths.licenses, jsonText(licenseReport));
emit(outputPaths.notices, `${markdownNotices(allLicenses, policy)}\n`);

if (policy.status !== "PASS") {
  throw new Error(`Dependency license policy failed: ${policy.blocked.length} blocked, ${policy.unknown.length} unknown`);
}

const hashes = Object.values(outputPaths).map((path) => `${sha256(readFileSync(resolve(root, path)))}  ${path}`);
console.log(`Supply-chain artifacts ${checkOnly ? "verified" : "generated"}: ${allLicenses.length} dependencies`);
console.log(hashes.join("\n"));
