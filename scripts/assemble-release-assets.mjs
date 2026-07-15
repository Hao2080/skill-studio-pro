import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, values) => {
  if (value.startsWith("--")) pairs.push([value.slice(2), values[index + 1]]);
  return pairs;
}, []));
const input = resolve(root, args.input ?? "downloaded-artifacts");
const output = resolve(root, args.output ?? "publish-assets");
const expectedOutput = resolve(root, "publish-assets");
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const filesUnder = (path) => readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
  const target = join(path, entry.name);
  return entry.isDirectory() ? filesUnder(target) : [target];
});

if (output !== expectedOutput) throw new Error(`Refusing to replace unexpected output directory: ${output}`);
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
const manifests = filesUnder(input).filter((path) => /^artifact-manifest-(?:windows|macos|linux)\.json$/.test(basename(path)));
if (manifests.length !== 3) throw new Error(`Expected three platform manifests, found ${manifests.length}`);

const copied = new Set();
function copyUnique(source, preferredName = basename(source)) {
  if (copied.has(preferredName)) throw new Error(`Release asset filename collision: ${preferredName}`);
  copied.add(preferredName);
  copyFileSync(source, join(output, preferredName));
}

for (const manifestPath of manifests) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const directory = dirname(manifestPath);
  for (const file of manifest.files) {
    const source = join(directory, file.name);
    if (!statSync(source).isFile() || statSync(source).size !== file.bytes || sha256(source) !== file.sha256) {
      throw new Error(`Downloaded artifact failed manifest verification: ${source}`);
    }
  }
  for (const source of readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => join(directory, entry.name))) {
    copyUnique(source);
  }
}

const common = [
  ["artifacts/sbom/frontend.cdx.json", "frontend.cdx.json"],
  ["artifacts/sbom/rust.cdx.json", "rust.cdx.json"],
  ["artifacts/sbom/skill-studio-pro.cdx.json", "skill-studio-pro.cdx.json"],
  ["artifacts/THIRD-PARTY-LICENSES.json", "THIRD-PARTY-LICENSES.json"],
  ["docs/THIRD-PARTY-NOTICES.md", "THIRD-PARTY-NOTICES.md"],
  ["LICENSE", "LICENSE.txt"],
  ["NOTICE", "NOTICE.txt"],
];
for (const [source, name] of common) copyUnique(resolve(root, source), name);

const records = readdirSync(output).sort().map((name) => {
  const path = join(output, name);
  return { name, bytes: statSync(path).size, sha256: sha256(path) };
});
const manifest = { schemaVersion: 1, product: "Skill Studio Pro", version: "0.1.0-beta.1", files: records };
writeFileSync(join(output, "release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
const checksumRecords = [...records, {
  name: "release-manifest.json",
  bytes: statSync(join(output, "release-manifest.json")).size,
  sha256: sha256(join(output, "release-manifest.json")),
}];
writeFileSync(join(output, "SHA256SUMS.txt"), `${checksumRecords.map((file) => `${file.sha256}  ${file.name}`).join("\n")}\n`);

for (const file of manifest.files) {
  const path = join(output, file.name);
  if (statSync(path).size !== file.bytes || sha256(path) !== file.sha256) throw new Error(`Final hash mismatch: ${file.name}`);
}
console.log(`Verified and assembled ${checksumRecords.length + 1} release assets in ${output}`);
