# Skill Studio Pro Architecture

Repository: https://github.com/Hao2080/skill-studio-pro

Skill Studio Pro is a Tauri 2 desktop application with a React 18/TypeScript frontend, a Rust application/service layer, SQLite metadata, and controlled local-file transactions. The authoritative detailed design is [TECHNICAL-DESIGN.md](TECHNICAL-DESIGN.md).

```text
React UI
  -> typed Tauri IPC commands/events
    -> Rust commands (validation and serialization)
      -> application services and operation plans
        -> SQLite repositories / filesystem transactions / adapters
          -> local workspace, Agent Skill roots, OS Secret Store, optional Providers
```

## Frontend domains

- `inventory`: scan roots, discovered external instances, raw files, duplicates, provenance, and read-only registration entry.
- `skills` / `library`: central copies, snapshots, editor, diff, publishing, drift, mapping removal, and trash planning.
- `platforms`: real detection/configuration for Codex, Claude Code, Cursor, Windsurf, Gemini CLI, and custom adapters.
- `lifecycle`, `trash`, `activity`: import plans, safe writes, operation history, restore, and restricted purge.
- `ai-settings`: Provider configuration, secure credential references, task routes, generation, cancellation, cache, and attribution.
- `shared`: typed IPC wrappers, presentation components, browser-preview mocks, and Pro design tokens.

Production Tauri pages use real IPC. `?preview=pro` is a deliberate browser-only mock surface and is never release evidence.

## Rust domains

- `inventory` and `origin`: bounded directory walking, parsing, hashing, incremental index, duplicate relationships, evidence, and deterministic confidence.
- `services` / `library` / `platform`: stable central identity, registration, Adapter registry, publish plans, ownership, drift, and per-target transactions.
- `lifecycle` / `trash`: staged import, safe editing, recovery points, journals, soft delete, restore, and purge confirmation.
- `ai` / `credentials`: MiniMax/OpenAI-compatible Providers, structured schemas, routing, redaction, cancellation, caching, and native Secret Store access.
- `db`, `store`, `workspace`, `snapshot`: SQLite migrations/repositories, upstream-compatible store behavior, isolated path resolution, snapshots, and diff.
- `commands`: thin Tauri IPC registration and DTO boundary.

## Local data

The default workspace is independent from upstream:

```text
~/.skill-studio-pro/
  metadata.db
  workspace.json
  skills/
  snapshots/
  trash/
  imports/
  staging/
  logs/
  cache/ai/
```

API Keys are not stored in this tree. Persistent credentials use Windows Credential Manager, macOS Keychain, or Linux Secret Service. A native-store failure never silently falls back to SQLite, JSON, or a plaintext file.

## Transaction and trust model

- Scanned and imported Skill content is untrusted and never automatically executed.
- External instances remain read-only until the user approves a hash-bound registration plan.
- High-risk operations use stable IDs, normalized allowed roots, short-lived plans, source/target hashes, staging, ownership markers, atomic replacement when supported, and recovery journals.
- Publishing defaults to copy. Symlink mode requires a real capability probe and never silently falls back.
- Delete means application trash. Permanent deletion accepts a database-resolved trash entry and short-lived confirmation token, not an arbitrary path.
- AI is optional; deterministic filesystem/Git/YAML/hash facts are not delegated to a model.

## Release architecture

Windows, macOS, and Linux hosted runners each run frontend/Rust gates, native Secret Store contracts, Tauri packaging, and installed startup smoke in isolated directories. A separate supply-chain job verifies locks, reproducible CycloneDX SBOMs, license policy, dependency audits, repository hygiene, and full-history secret scanning. The release job downloads platform artifacts and verifies hashes again before creating the prerelease.

Automatic updates are disabled. The beta is unsigned and macOS is not notarized; see [RELEASE.md](RELEASE.md) and [SECURITY.md](../SECURITY.md).
