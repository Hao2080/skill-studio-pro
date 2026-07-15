<p align="center">
  <img src="./public/assets/brand/skill-studio-pro-wordmark-placeholder.svg" alt="Skill Studio Pro" width="900" />
</p>

# Skill Studio Pro

Skill Studio Pro is a local-first, cross-platform desktop application for managing AI Agent Skill assets. This repository is currently at the Wave 0 baseline: it preserves and validates the upstream workspace, Skill management, snapshot, market, platform, project, and team-compatibility foundations while establishing independent Pro naming, storage, placeholder branding, update isolation, and cross-platform CI.

Wave 0 does not implement the planned Pro inventory scanner, AI integration, central mapping, install planning, or trash features. Later modules will build those capabilities on this baseline.

## Upstream relationship

Skill Studio Pro is derived from the open-source [liu673/skill-studio](https://github.com/liu673/skill-studio) project.

- Audited upstream baseline: [`cd0bb0af53865d4a9643968080bfc5a8137b72d9`](https://github.com/liu673/skill-studio/commit/cd0bb0af53865d4a9643968080bfc5a8137b72d9)
- Upstream authorship, contributor copyright, Apache-2.0 `LICENSE`, and `NOTICE` are preserved
- The `upstream` Git remote points to the original repository for auditability and future synchronization
- The npm package, Rust crate and binary, Tauri identifier, data directory, and brand assets are independent from upstream

See [SPEC](docs/SPEC.md), [PRD](docs/PRD.md), [technical design](docs/TECHNICAL-DESIGN.md), and [automated testing](docs/AUTOMATED-TESTING.md) for the planned product scope.

## Baseline identities

| Item | Value |
|---|---|
| Product | Skill Studio Pro |
| npm package | `skill-studio-pro` |
| Rust package / binary | `skill-studio-pro` |
| Rust library crate | `skill_studio_pro_lib` |
| Tauri identifier | `app.skillstudiopro` |
| Default workspace | `~/.skill-studio-pro/` |
| Stack | Tauri 2, React 18, TypeScript, Rust, SQLite |

## Branding and updates

Wave 0 uses independent Pro placeholder assets under `public/assets/brand/`; the upstream logo is not used as the formal Pro identity. A later branding workstream may replace these placeholders.

Automatic updates are explicitly disabled. The repository contains no upstream update endpoint, public key, or updater capability and does not generate updater artifacts. Do not enable updates until Skill Studio Pro has its own release repository, signing keys, and update source. Upstream Release installers are not Skill Studio Pro installers.

## Build and validate

Prerequisites are Node.js 22, stable Rust, Git, and the target platform's [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/).

```bash
npm ci
npm run tauri dev
```

```bash
npm run typecheck
npm run test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
npm run check
```

GitHub Actions runs the baseline checks on Windows, macOS, and Linux. CI must not call real AI providers or include API keys, databases, logs, or local Skills.

## Local data and security

- Pro data defaults to `~/.skill-studio-pro/` and does not automatically reuse or overwrite upstream `~/.skill-studio/`
- Imported Skills are not automatically executed during discovery or display
- Market browsing and Git imports may make user-initiated network requests
- `.gitignore` excludes local databases, logs, trash, credential files, local Skills, and build output
- Report vulnerabilities according to [SECURITY.md](SECURITY.md)

## License and attribution

Skill Studio Pro remains licensed under the **Apache License, Version 2.0**. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

This derivative preserves the original Skill Studio authors, contributors, copyright notices, and upstream attribution. Third-party platform names and logos remain the property of their respective owners and are used only for identification and interoperability.
