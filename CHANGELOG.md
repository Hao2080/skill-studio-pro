# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Release types:**
> - `Added` — new features
> - `Changed` — changes in existing functionality
> - `Deprecated` — soon-to-be removed features
> - `Removed` — removed features
> - `Fixed` — bug fixes
> - `Security` — vulnerability fixes

---

## [0.1.0] - 2026-05-07

### Added

- Local-first Skill workspace with persistent storage
- Skill lifecycle management: create, import, search, categorize, tag, and batch organize
- Skill file browser with inline preview, in-app editing, external editor launch, and directory access
- Version snapshots: create, view history, compare diffs, restore working copy, and set active version
- Multi-source import: local directories, Git repositories, built-in templates, and platform scans
- Agent platform detection with configurable Skill directory sync
- Project workspaces with cross-platform sync planning and execution logs
- Team spaces with shared Skill library, submissions, diff review, merge, recommended versions, and pull
- Theme switching (light/dark), language configuration, pre-sync restore points, and snapshot retention limits
- Open source governance: Apache License 2.0, contributing guidelines, security policy, code of conduct, and third-party notices

### Known Issues

- **File system capability**: Tauri capabilities currently grant broad file system access. Scope will be narrowed to minimum necessary permissions before the first stable release.
- **Installers and signing**: Preview installers are published for Windows, macOS, and Linux, but Windows code signing and macOS notarization are not yet finalized.
- **UI polish**: Some page layouts and internationalized strings are still being refined for consistency.
- **Third-party Skill trust**: Imported Skills from external markets do not yet have provenance confidence scoring or dependency license reporting.

---

## [Unreleased] — History

Prior to v0.1.0, this project was in private development. No public changelog entries exist.
