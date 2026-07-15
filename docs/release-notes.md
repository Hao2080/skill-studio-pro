# Skill Studio Pro v0.1.0-beta.1

This is the first public beta of Skill Studio Pro, an Apache-2.0, local-first desktop manager for AI Agent Skills.

Repository: https://github.com/Hao2080/skill-studio-pro

## Highlights

- Read-only inventory across Codex, Claude Code, Cursor, Windsurf, Gemini CLI, plugin caches, project roots, and custom scan roots.
- Deterministic metadata, duplicate detection, provenance evidence, confidence rationale, and raw `SKILL.md` viewing.
- Stable-ID central library, snapshots, safe text editing, copy-based multi-agent publishing, drift detection, and owned-target removal.
- Install previews for local directories, Git repositories, ZIP archives, and upstream market sources without executing imported scripts.
- Trash, conflict-aware restore, restricted permanent deletion, operation history, and crash-recovery journals.
- Optional MiniMax/OpenAI-compatible enrichment with secure native credential storage, cancellation, caching, staleness, redaction, and actual model attribution.
- Deep-ocean Pro desktop UI validated on Windows release/NSIS at 900×600, 1280×800, 150% DPI, keyboard focus, reduced motion, and reduced transparency.

## Platform evidence

Windows, macOS, and Linux GitHub-hosted runners each execute the frontend and Rust quality gates, a real native Secret Store contract using a disposable test entry, Tauri installer construction, and installed/mounted desktop startup smoke in an isolated home/config/workspace. Linux uses an isolated D-Bus Secret Service and Xvfb display harness.

The Windows release candidate also completed the isolated full lifecycle UAT and the 1,000 Skill / 100,000 file benchmark recorded in `docs/handoffs/WINDOWS-UAT.md`.

## Assets and verification

The Release contains:

- Windows NSIS, macOS DMG, Linux deb and AppImage packages
- Per-platform hashes, manifests, quality logs, smoke JSON/logs, and Secret Store logs
- `SHA256SUMS.txt` plus `release-manifest.json`
- Frontend, Rust, and combined CycloneDX 1.6 JSON SBOMs
- Machine-readable dependency licenses and the third-party dependency/asset notice
- Apache-2.0 `LICENSE` and upstream-preserving `NOTICE`

Verify the downloaded files against `SHA256SUMS.txt`. Hash verification establishes byte integrity relative to this GitHub Release; it is not a substitute for platform publisher signing.

## Known limitations

- Windows is not Authenticode-signed.
- macOS is not Developer ID-signed or notarized.
- Linux packages are not distribution-signed.
- Automatic updates are disabled and no updater metadata or signatures are included.
- CI does not call real MiniMax or OpenAI paid endpoints. Real Provider compatibility depends on user configuration, endpoint behavior, model access, quota, and network policy.
- Linux persistent credentials require an available and unlocked Secret Service; the application never silently falls back to plaintext.
- Symlink publishing depends on actual OS/filesystem capability and privilege. Copy remains the default.
- The current primary product language is Simplified Chinese; some inherited or advanced surfaces are not fully localized.

Read [README.md](../README.md), [SECURITY.md](../SECURITY.md), and [CHANGELOG.md](../CHANGELOG.md) before installing the beta.
