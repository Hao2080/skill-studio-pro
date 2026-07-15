import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, values) => {
  if (value.startsWith("--")) pairs.push([value.slice(2), values[index + 1]]);
  return pairs;
}, []));
const platform = args.platform;
const bundleRoot = resolve(root, args["bundle-root"] ?? "src-tauri/target/release/bundle");
const output = resolve(root, args.output ?? `release-assets/${platform}`);
const releaseAssetsRoot = resolve(root, "release-assets");
const version = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;
const allowed = {
  windows: [/\.exe$/i],
  macos: [/\.dmg$/i],
  linux: [/\.AppImage$/i, /\.deb$/i],
};
if (!allowed[platform]) throw new Error(`Unsupported platform: ${platform}`);

function filesUnder(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const target = join(path, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  });
}
const candidates = filesUnder(bundleRoot)
  .filter((path) => allowed[platform].some((pattern) => pattern.test(path)))
  .filter((path) => basename(path).includes(version))
  .sort();
if (!candidates.length) throw new Error(`No ${platform} installer found under ${bundleRoot}`);

if (!output.startsWith(`${releaseAssetsRoot}${sep}`)) {
  throw new Error(`Refusing to stage outside ${releaseAssetsRoot}: ${output}`);
}
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
const files = candidates.map((source) => {
  const name = basename(source).replaceAll(" ", "_");
  const destination = join(output, name);
  copyFileSync(source, destination);
  const data = readFileSync(destination);
  return { name, bytes: statSync(destination).size, sha256: createHash("sha256").update(data).digest("hex") };
});
const manifest = {
  schemaVersion: 1,
  product: "Skill Studio Pro",
  version,
  platform,
  signing: platform === "macos" ? "not Developer ID signed or notarized" : "unsigned",
  files,
};
writeFileSync(join(output, `artifact-manifest-${platform}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(output, `sha256sums-${platform}.txt`), `${files.map((file) => `${file.sha256}  ${file.name}`).join("\n")}\n`);
console.log(JSON.stringify(manifest, null, 2));
