import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readWorkflow = (name: string) =>
  readFileSync(resolve(process.cwd(), ".github", "workflows", name), "utf8");

describe("GitHub Actions release-quality contract", () => {
  it("runs quality, native Secret Store, package, and installed smoke on three real runners", () => {
    const workflow = readWorkflow("ci.yml");
    for (const runner of ["ubuntu-latest", "windows-latest", "macos-latest"]) {
      expect(workflow).toContain(`os: ${runner}`);
    }
    for (const command of [
      "npm ci",
      "npm run typecheck",
      "npm run test",
      "npm run build",
      "cargo fmt --manifest-path src-tauri/Cargo.toml --check",
      "cargo check --manifest-path src-tauri/Cargo.toml",
      "cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings",
      "cargo test --manifest-path src-tauri/Cargo.toml",
    ]) {
      expect(workflow, command).toContain(`run: ${command}`);
    }
    expect(workflow).toContain("components: rustfmt, clippy");
    expect(workflow).toContain("workspaces: src-tauri");
    expect(workflow).toContain("npm run security:repo");
    expect(workflow).toContain("npm run supply-chain:check");
    expect(workflow).toContain("git remote add upstream https://github.com/liu673/skill-studio.git");
    expect(workflow).toContain("npm audit --audit-level=high");
    expect(workflow).toContain("rustsec/audit-check@");
    expect(workflow).toContain("gitleaks/gitleaks-action@");
    expect(workflow).toContain("native_secret_store_contract");
    expect(workflow).toContain("test-secret-store-linux.sh");
    expect(workflow).toContain("build --ci --bundles");
    expect(workflow).toContain("smoke-windows.ps1");
    expect(workflow).toContain("smoke-macos.sh");
    expect(workflow).toContain("smoke-linux.sh");
    expect(workflow).toContain("stage-release-assets.mjs");
  });

  it("blocks the prerelease on three platform gates and downloaded hash verification", () => {
    const workflow = readWorkflow("release.yml");
    for (const runner of ["ubuntu-latest", "windows-latest", "macos-latest"]) {
      expect(workflow).toContain(`os: ${runner}`);
    }
    expect(workflow).toContain("npm run check 2>&1");
    expect(workflow).toContain("npm run supply-chain:check");
    expect(workflow).toContain("git remote add upstream https://github.com/liu673/skill-studio.git");
    expect(workflow).toContain("npm audit --audit-level=high");
    expect(workflow).toContain("rustsec/audit-check@");
    expect(workflow).toContain("native_secret_store_contract");
    expect(workflow).toContain("assemble-release-assets.mjs");
    expect(workflow).toContain("actions/download-artifact@");
    expect(workflow).toContain("gh release create");
    expect(workflow).toContain("--prerelease");
    expect(workflow).toContain("--verify-tag");
    expect(workflow).not.toContain("includeUpdaterJson: true");
  });
});
