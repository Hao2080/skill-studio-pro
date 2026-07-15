# Security Policy

## Supported releases

Skill Studio Pro is currently a public beta. Security fixes are made against the latest prerelease and `main`; older beta builds may not receive backports.

| Version | Supported |
|---|---|
| `0.1.0-beta.1` / `main` | Yes |
| Older or upstream Skill Studio builds | No |

## Report a vulnerability privately

Do not open a public issue with exploit details, real credentials, private Skill content, database contents, or personal paths.

Use [GitHub Private Vulnerability Reporting](https://github.com/Hao2080/skill-studio-pro/security/advisories/new). Include the affected version/commit, operating system, installation method, minimal reproduction, impact, and any safe mitigation. Use fixture data and redact secrets.

The maintainer will acknowledge the report, assess severity and affected versions, coordinate a fix, and agree on disclosure timing. Response time depends on impact and maintainer availability; this beta does not promise a commercial support SLA.

## Security model and boundaries

1. **Local-first storage.** Runtime data defaults to `~/.skill-studio-pro/`. The application does not enable telemetry or cloud synchronization.
2. **External Skill content is untrusted.** Scan, preview, import, provenance analysis, and AI summarization do not execute scripts, commands, installers, or hooks from a Skill.
3. **Writes are scoped and recoverable.** Central-library edits, publishing, trash, restore, and purge use stable IDs, allowed-root checks, plan hashes, staging, ownership markers, atomic replacement where supported, and recovery journals.
4. **AI is optional and explicit.** Content is sent only after an explicit generation action or opt-in auto-enrichment. Provider requests are minimized and redacted. CI uses loopback mocks and blocks paid provider domains.
5. **Secrets stay outside ordinary files.** Persistent keys use Windows Credential Manager, macOS Keychain, or Linux Secret Service. If the native store is unavailable, the application refuses persistent plaintext fallback; process-only storage remains an explicit option.
6. **Imported sources may use the network.** User-initiated Git/market import and configured AI providers make outbound requests. Remote provider compatibility and trust remain the user's responsibility.

## Release trust boundary

`v0.1.0-beta.1` packages are test builds, not identity-signed production distributions:

- Windows is not Authenticode-signed.
- macOS is not Developer ID-signed or notarized.
- Linux packages are not distribution-signed.
- Automatic updates are disabled; no updater key or endpoint is configured.

Each release includes SHA-256 manifests, CycloneDX SBOMs, dependency/license records, and platform smoke evidence. Hashes prove download integrity relative to the GitHub Release manifest; they do not establish publisher identity in the way platform code signing does.

## In-scope security areas

- Path traversal, symlink/junction escape, Zip Slip, or unsafe recursive operations
- Bypass of plan/hash/ownership checks during edit, publish, trash, restore, or purge
- API Key or sensitive Skill content written to SQLite, JSON, logs, crash output, Git, or release assets
- Unintended execution of imported Skill content
- Provider request redaction, credential isolation, or permission boundary failures
- Supply-chain, dependency, build workflow, artifact manifest, or release integrity issues

General bugs and feature requests belong in [GitHub Issues](https://github.com/Hao2080/skill-studio-pro/issues). See [CONTRIBUTING.md](CONTRIBUTING.md) for secure development requirements.
