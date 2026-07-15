# Contributing to Skill Studio Pro

Thank you for improving Skill Studio Pro. By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately through the process in [SECURITY.md](SECURITY.md), not through a public issue.

## Development setup

Prerequisites:

- Node.js 22
- Rust stable with `rustfmt` and `clippy`
- Git
- The target platform's [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/)

```bash
git clone https://github.com/Hao2080/skill-studio-pro.git
cd skill-studio-pro
npm ci
npm run tauri dev
```

Browser preview is useful for presentation work, but it uses typed mock IPC and is not evidence that a desktop workflow works. File-system, Secret Store, WebView, package, and installation behavior must be tested through the real Tauri application or an isolated platform harness.

## Required checks

Run before opening a pull request:

```bash
npm run typecheck
npm run test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
npm run check
npm run security:repo
npm run supply-chain:check
git diff --check
```

Do not delete, skip, weaken, or platform-exclude a failing test merely to make CI green. Bug fixes should add a regression test or a repeatable isolated reproduction before the implementation change.

## Safety rules

- Never use real user Agent directories, Skills, databases, logs, credentials, or paid Provider calls in automated tests.
- Use temporary roots and fictional credentials. Native Secret Store tests must create a unique test account and delete only that account.
- Commands that write, move, restore, or delete files accept stable IDs and server-side resolved paths; do not add arbitrary absolute-path mutators.
- Preserve upstream Apache-2.0 attribution, `LICENSE`, `NOTICE`, and the `upstream` remote relationship.
- Keep automatic updates disabled unless this repository has an independently reviewed signing key and update endpoint.
- Do not add assets or dependencies with an unknown license. Run `npm run sbom:generate` after changing either lockfile, inspect the license-policy result, and commit the generated artifacts.
- Do not commit build output, screenshots containing personal information, local paths, API Keys, SQLite files, logs, staging data, trash, or Skill content.

## Pull requests

Use a focused branch such as `feat/...`, `fix/...`, `docs/...`, `test/...`, or `chore/...`. Follow Conventional Commits for commit subjects.

A pull request should explain:

- What changed and why
- User-visible and migration impact
- Security and data-loss risk
- Tests and platform evidence
- Screenshots for UI changes, using fixture-only data
- Any signing, notarization, Provider, or OS behavior that remains unverified

Use the pull request template. All required Windows, macOS, Linux, supply-chain, and secret-scan jobs must pass before merge.

## Architecture and style

- React components call typed APIs; production pages must not import browser-preview mocks.
- Tauri commands validate and serialize; services own use cases; repositories own SQLite; adapters own platform/provider differences.
- Rust business logic should remain testable without a desktop window.
- Use `cargo fmt`, TypeScript strict types, existing Pro design tokens, and accessible text states that do not rely on color alone.
- Update [CHANGELOG.md](CHANGELOG.md), public documentation, SBOMs, and migration notes when behavior, dependencies, assets, versions, or data formats change.

## Licensing

Contributions are licensed under Apache-2.0 unless explicitly stated otherwise in an accepted third-party asset notice. By submitting a contribution, you represent that you have the right to do so and that required attribution is included.
