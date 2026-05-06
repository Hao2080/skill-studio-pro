# Security Policy

## Supported Versions

Only the latest release is supported for security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

We take security issues seriously. If you discover a vulnerability,
please report it responsibly.

**Please do not open public GitHub issues for security vulnerabilities.**

### How to Report

Use one of the following methods:

1. **GitHub Security Advisories** — navigate to the repository's
   **Security** tab and click **Report a vulnerability**
2. **Email** — send details to **skillstudio@proton.me**

### What to Include

Please provide as much of the following as possible:

- Affected version or commit range
- Operating system and installation method
- Steps to reproduce the issue
- Impact assessment (data loss, file read/write, remote execution, etc.)
- Any potential mitigations you are aware of

### Response Timeline

We aim to acknowledge reports within **48 hours** and to provide a
timeline for fix and disclosure within **7 days**. The actual resolution
time depends on complexity.

| Severity | Expected Response | Expected Fix |
|---|---|---|
| Critical | 24 hours | 7 days |
| High | 48 hours | 30 days |
| Medium | 5 days | 60 days |
| Low | 14 days | 90 days |

Severity is assessed using CVSS 3.1 by the maintainers.

## Security Design Boundaries

Understanding these boundaries helps you assess the impact of any vulnerability:

1. **Local-first data storage** — all user data (Skills, snapshots, settings, SQLite metadata) is stored in `~/.skill-studio/`. No data is uploaded to any remote service by default.

2. **Network access is scoped** — external market browsing and Git import fetch data over HTTPS. These are the only outbound network operations; the application does not make arbitrary outbound connections.

3. **File system access is user-directed** — the application reads and writes only within:
   - The user-configured workspace directory (`~/.skill-studio/` by default)
   - Agent platform Skill directories explicitly added by the user
   - Project directories explicitly bound to a project in the application

4. **Third-party Skills are untrusted input** — Skills imported from external markets, Git repositories, or local directories may contain scripts, commands, or credential-fetching instructions. They are stored as files and displayed, but **never automatically executed**.

5. **Platform sync is additive** — sync operations copy files to user-configured directories. The application does not delete or overwrite files outside of explicitly configured target directories without user confirmation.

## Areas Requiring Ongoing Security Review

These areas are known to require continued attention and are tracked
internally:

- **Tauri capabilities**: file system, shell, and network permissions should be
  scoped to minimum necessary access before the first stable release
- **External imports**: path traversal, archive extraction escape, and oversized
  file handling for Git repository and market imports
- **Platform sync**: race conditions, directory conflicts, and atomic write
  guarantees during concurrent sync operations
- **Data migration**: SQLite schema migrations must be backward-compatible
  and have tested rollback paths

## Security Acknowledgments

We maintain a list of security researchers and contributors who have
responsibly disclosed vulnerabilities. If you report a confirmed
security issue that is fixed in a release, you will be credited by name
(unless you prefer to remain anonymous) in the release notes.

## Related Policies

- [Contributing Guidelines](CONTRIBUTING.md) — covers secure development practices
- [Code of Conduct](CODE_OF_CONDUCT.md) — community behavior expectations
- [NOTICE](NOTICE) — open source attribution and license information
