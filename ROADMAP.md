# Skill Studio Pro Roadmap

Repository: https://github.com/Hao2080/skill-studio-pro

## Public Beta maintenance

- Fix reproducible beta defects without weakening file safety, credential isolation, provenance semantics, or test gates.
- Keep Windows, macOS, and Linux package/startup/Secret Store CI green.
- Improve Simplified Chinese and English localization, screen-reader flow, focus restoration, and platform visual QA.
- Expand long-running watcher, permission-error, TOCTOU, network interruption, and large-inventory regression coverage.
- Keep dependency licenses, CycloneDX SBOMs, hashes, upstream attribution, and public documentation current.

## Stable-candidate requirements

- Decide and implement a maintainer-owned Windows signing and macOS Developer ID/notarization process, or retain a clearly documented unsigned distribution model.
- Define a Pro-owned updater signing key and endpoint before enabling automatic updates; upstream keys/endpoints will not be reused.
- Validate more distributions/filesystems and successful symlink branches where real OS permissions permit.
- Complete broader English localization, accessibility-assistive-technology review, and beta defect regression.
- Re-audit SQLite migrations, crash recovery, backup/restore, import limits, and artifact reproducibility.

## Not planned for V1

- Required accounts, telemetry, hosted cloud sync, or cloud backup
- Automatic execution of imported Skill code
- Team spaces, approvals, or multi-user collaboration
- A repository-operated hosted Skill marketplace
- Claims that provenance confidence is a malware or absolute safety score

Use [GitHub Issues](https://github.com/Hao2080/skill-studio-pro/issues) for reproducible bugs and concrete proposals. Security reports must follow [SECURITY.md](SECURITY.md).
