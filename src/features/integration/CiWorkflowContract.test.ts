import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readWorkflow = (name: string) =>
  readFileSync(resolve(process.cwd(), ".github", "workflows", name), "utf8");

describe("GitHub Actions release-quality contract", () => {
  it("runs the complete baseline on Windows, macOS, and Linux", () => {
    const workflow = readWorkflow("ci.yml");
    for (const runner of ["ubuntu-latest", "windows-latest", "macos-latest"]) {
      expect(workflow).toContain(`- ${runner}`);
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
    expect(workflow).toContain("gitleaks/gitleaks-action@v2");
  });

  it("blocks every platform release on the same quality gate", () => {
    const workflow = readWorkflow("release.yml");
    expect(workflow.match(/run: npm ci/g)).toHaveLength(3);
    expect(workflow.match(/run: npm run check/g)).toHaveLength(3);
    expect(workflow.match(/uses: tauri-apps\/tauri-action@v0/g)).toHaveLength(6);
    expect(workflow.match(/components: rustfmt, clippy/g)).toHaveLength(3);
    expect(workflow.match(/workspaces: src-tauri/g)).toHaveLength(3);
  });
});
