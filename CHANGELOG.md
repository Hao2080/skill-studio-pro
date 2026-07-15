# Changelog

All notable Skill Studio Pro changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-beta.1] - 2026-07-16

### Added

- Local-first inventory for five primary Agents, plugin caches, project directories, custom roots, incremental scans, file indexing, duplicates, and deterministic provenance evidence.
- Stable central Skill identities, snapshots, safe registration, multi-agent copy publishing, drift policies, ownership markers, and per-target results.
- Local/Git/ZIP/market installation previews with staging, hash-bound plans, conflict policies, limits, and no external script execution.
- Safe Markdown/YAML/JSON/TOML/text editing with dirty guards, validation, recovery points, atomic replacement, diffs, and outdated mapping status.
- Application trash, conflict-aware restore, confirmation-token purge, operation history, and lifecycle crash recovery.
- MiniMax/OpenAI-compatible routing, secure native credentials, structured artifacts, cancellation, caching, staleness, redaction, and model attribution.
- Real platform and scan-root management UI, Windows release WebView lifecycle UAT, accessibility/responsive checks, and the 1,000 Skill / 100,000 file benchmark.
- Independent public repository metadata, three-platform installer/startup/Secret Store CI, CycloneDX SBOMs, license policy, release manifests, and SHA-256 verification.

### Changed

- Product, package, binary, Tauri identifier, data directory, brand, and release infrastructure are independent from upstream Skill Studio.
- Automatic updates remain disabled until Skill Studio Pro owns a reviewed signing and update chain.

### Security

- Added allowed-root and ownership checks, path/symlink/junction/Zip Slip defenses, plan expiry and hash validation, atomic file transactions, no-plaintext credential fallback, repository hygiene, dependency audits, and full-history secret scanning.

### Known limitations

- Beta packages are unsigned; macOS is not notarized and Linux packages are not distribution-signed.
- CI uses Mock AI providers; real Provider access is user-configured and not asserted by this release.
- Linux persistent credentials require an unlocked Secret Service; symlink support remains platform/privilege dependent.

## Upstream baseline

Skill Studio Pro preserves the complete Apache-2.0 history and attribution of `liu673/skill-studio` through commit `cd0bb0af53865d4a9643968080bfc5a8137b72d9`. Earlier upstream product history remains available in Git rather than being relabeled as a Skill Studio Pro public release.
