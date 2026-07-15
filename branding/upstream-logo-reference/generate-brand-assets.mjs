import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, execSync } from "node:child_process";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempDir = resolve(rootDir, ".tmp-generated-icons");
const publicLogoDir = resolve(rootDir, "public/assets/logo");
const tauriIconDir = resolve(rootDir, "src-tauri/icons");
const logoSvgPath = resolve(publicLogoDir, "logo-icon.svg");
const logoMasterPath = resolve(publicLogoDir, "logo-master.png");
const logoIconMasterPath = resolve(publicLogoDir, "logo-icon-master-compact.png");
const appIconMasterPath = resolve(publicLogoDir, "logo-app-icon-master.png");
const appIconSvgPath = resolve(publicLogoDir, "logo-app-icon.svg");
const horizontalLogoPath = resolve(publicLogoDir, "logo-horizontal.png");
const horizontalLogoScriptPath = resolve(rootDir, "scripts/generate-horizontal-logo.ps1");
const prepareLogoMasterScriptPath = resolve(rootDir, "scripts/prepare-logo-master.py");

function ensureDirectory(path) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function cleanPath(path) {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
  }
}

function buildSquareEmbeddedSvg(imageDataUri) {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1254 1254" fill="none">',
    `  <image href="${imageDataUri}" width="1254" height="1254" preserveAspectRatio="xMidYMid meet" />`,
    "</svg>",
    "",
  ].join("\n");
}

function toDataUri(filePath) {
  const bytes = readFileSync(filePath);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

function runTauriIcon(args) {
  if (process.platform === "win32") {
    const quote = (value) => `"${String(value).replace(/"/g, '\\"')}"`;
    const commandLine = `npm exec -- tauri icon ${args.map(quote).join(" ")}`;

    execSync(commandLine, {
      cwd: rootDir,
      stdio: "inherit",
    });
    return;
  }

  execFileSync("npm", ["exec", "--", "tauri", "icon", ...args], {
    cwd: rootDir,
    stdio: "inherit",
  });
}

function runPowerShellScript(scriptPath, args) {
  if (process.platform !== "win32") {
    if (!existsSync(horizontalLogoPath)) {
      throw new Error("Missing logo-horizontal.png and PowerShell generation is only supported on Windows.");
    }

    return;
  }

  execFileSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args],
    {
      cwd: rootDir,
      stdio: "inherit",
    },
  );
}

function runPythonScript(scriptPath) {
  const candidates =
    process.platform === "win32"
      ? [
          process.env.CODEX_WORKSPACE_PYTHON,
          "C:\\Users\\jense\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe",
          process.env.PYTHON,
          "python",
          "py",
        ]
      : [process.env.CODEX_WORKSPACE_PYTHON, process.env.PYTHON, "python3", "python"];

  let lastError;
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      const args = candidate === "py" ? ["-3", scriptPath] : [scriptPath];
      execFileSync(candidate, args, {
        cwd: rootDir,
        stdio: "inherit",
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("No Python runtime available for brand asset generation.");
}

function removeGeneratedExtras() {
  const cleanupTargets = [
    "src-tauri/icons/128x128@2x.png",
    "src-tauri/icons/64x64.png",
    "src-tauri/icons/Square107x107Logo.png",
    "src-tauri/icons/Square142x142Logo.png",
    "src-tauri/icons/Square150x150Logo.png",
    "src-tauri/icons/Square284x284Logo.png",
    "src-tauri/icons/Square30x30Logo.png",
    "src-tauri/icons/Square310x310Logo.png",
    "src-tauri/icons/Square44x44Logo.png",
    "src-tauri/icons/Square71x71Logo.png",
    "src-tauri/icons/Square89x89Logo.png",
    "src-tauri/icons/StoreLogo.png",
    "src-tauri/icons/android",
    "src-tauri/icons/icon.png",
    "src-tauri/icons/ios",
  ];

  for (const relativePath of cleanupTargets) {
    rmSync(resolve(rootDir, relativePath), { recursive: true, force: true });
  }
}

function main() {
  ensureDirectory(publicLogoDir);
  ensureDirectory(tauriIconDir);
  cleanPath(tempDir);
  ensureDirectory(tempDir);

  runPythonScript(prepareLogoMasterScriptPath);

  if (!existsSync(logoMasterPath)) {
    throw new Error(`Missing logo master: ${logoMasterPath}`);
  }

  if (!existsSync(logoIconMasterPath)) {
    throw new Error(`Missing logo icon master: ${logoIconMasterPath}`);
  }

  if (!existsSync(appIconMasterPath)) {
    throw new Error(`Missing app icon master: ${appIconMasterPath}`);
  }

  writeFileSync(logoSvgPath, buildSquareEmbeddedSvg(toDataUri(logoIconMasterPath)), "utf8");
  writeFileSync(appIconSvgPath, buildSquareEmbeddedSvg(toDataUri(appIconMasterPath)), "utf8");

  runTauriIcon([logoSvgPath, "--png", "16", "--png", "32", "--png", "48", "--png", "256", "--png", "512", "-o", tempDir]);
  writeFileSync(resolve(publicLogoDir, "favicon-16.png"), readFileSync(resolve(tempDir, "16x16.png")));
  writeFileSync(resolve(publicLogoDir, "favicon-32.png"), readFileSync(resolve(tempDir, "32x32.png")));
  writeFileSync(resolve(publicLogoDir, "favicon-48.png"), readFileSync(resolve(tempDir, "48x48.png")));
  writeFileSync(resolve(publicLogoDir, "logo-256.png"), readFileSync(resolve(tempDir, "256x256.png")));
  writeFileSync(resolve(publicLogoDir, "logo-icon.png"), readFileSync(resolve(tempDir, "512x512.png")));
  writeFileSync(resolve(publicLogoDir, "logo-icon-dark.png"), readFileSync(resolve(tempDir, "512x512.png")));

  cleanPath(tempDir);
  ensureDirectory(tempDir);

  runTauriIcon([appIconSvgPath, "-o", tempDir]);
  writeFileSync(resolve(tauriIconDir, "32x32.png"), readFileSync(resolve(tempDir, "32x32.png")));
  writeFileSync(resolve(tauriIconDir, "128x128.png"), readFileSync(resolve(tempDir, "128x128.png")));
  writeFileSync(resolve(tauriIconDir, "icon.icns"), readFileSync(resolve(tempDir, "icon.icns")));
  writeFileSync(resolve(tauriIconDir, "icon.ico"), readFileSync(resolve(tempDir, "icon.ico")));

  const horizontalTempPath = resolve(tempDir, "logo-horizontal.png");
  runPowerShellScript(horizontalLogoScriptPath, ["-SourcePath", logoMasterPath, "-OutputPath", horizontalTempPath]);
  writeFileSync(horizontalLogoPath, readFileSync(horizontalTempPath));

  cleanPath(tempDir);
  removeGeneratedExtras();
}

main();
