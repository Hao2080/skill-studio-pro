# Contributing to Skill Studio

Thank you for your interest in contributing to Skill Studio. This document
outlines the process for contributing code, documentation, and bug reports.

## Code of Conduct

By participating, you agree to uphold our
[Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## Ways to Contribute

- **Report bugs** — open a GitHub issue with the Bug Report template
- **Suggest features** — open a GitHub issue with the Feature Request template
- **Write code** — fix bugs, implement features, or improve documentation
- **Review pull requests** — community review is valued and welcome

## Development Setup

### Prerequisites

- Node.js 18 or later
- Rust 1.75 or later
- Git
- Platform-specific build tools (see [Tauri prerequisites][tauri-prereq])

[tauri-prereq]: https://v2.tauri.app/start/prerequisites/

### Install Dependencies

```bash
git clone <repository-url>
cd skill-studio
npm install
```

### Start the Application

```bash
# Full desktop application with Tauri
npm run tauri dev

# Frontend only (hot reload, no Tauri features)
npm run dev
```

## Pre-commit Checks

All changes must pass the full validation suite before being submitted:

```bash
npm run check
```

This runs the following checks in sequence:

| Command | What it checks |
|---|---|
| `npm run typecheck` | TypeScript compilation |
| `npm test` | Frontend unit tests (Vitest) |
| `npm run build` | Frontend production build |
| `npm run rust:fmt` | Rust code formatting (cargo fmt) |
| `npm run rust:check` | Rust compilation |
| `npm run rust:test` | Rust unit and integration tests |

You may also run individual checks during development:

```bash
npm run typecheck     # fast, run frequently
npm test             # frontend tests
npm run build        # catches bundler issues
cargo fmt --check    # Rust formatting
cargo check          # Rust compilation
cargo test           # Rust tests
```

## Branch Naming

Use short, descriptive branch names:

| Prefix | Use for |
|---|---|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `refactor/` | Code refactoring without behavior change |
| `test/` | Adding or updating tests |
| `chore/` | Build scripts, dependency updates, CI changes |

Examples: `feat/team-diff-viewer`, `fix/platform-sync-path`, `docs/readme-badges`

## Commit Messages

Follow the [Conventional Commits][conventional-commits] specification:

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`

**Scope:** the affected module or area, e.g. `skills`, `snapshots`, `market`, `teams`

**Rules:**
- Use the imperative mood in the summary ("Add feature" not "Added feature")
- Keep the summary under 72 characters
- Separate subject from body with a blank line
- Explain *what* and *why*, not *how*
- Reference GitHub issues in the footer: `Closes #123`

**Examples:**
```
feat(skills): add tag filtering in skill workspace
fix(platforms): correct sync path resolution on Windows
docs(contributing): add testing requirements section
```

[conventional-commits]: https://www.conventionalcommits.org/

## Pull Request Process

### Before You Submit

1. **Sync your branch** — rebase on the latest `main` to avoid merge conflicts
2. **Run `npm run check`** — all checks must pass
3. **Write or update tests** — new behavior requires tests; bug fixes should include a regression test
4. **Keep changes focused** — one PR per concern (feature, fix, or refactor)

### PR Description

Every PR description should include:

- **What** — a clear description of the change
- **Why** — context or link to the relevant issue
- **How** — a brief summary of the implementation approach
- **Testing** — how you verified the change (attach screenshots for UI changes)
- **Breaking changes** — any changes that affect the public API, file formats, or data migration

### Review Expectations

- Reviews are welcome from any community member
- Maintainers aim to respond within 5 business days
- Address review feedback by pushing new commits rather than force-pushing
- Once approved and all checks pass, a maintainer will merge

## Security-sensitive Changes

The following categories of changes require an additional description of risk
and test coverage in the PR:

- Changes to Tauri capabilities (file system, network, shell permissions)
- File system operations: create, read, write, delete, rename, copy, restore
- Network requests or remote data processing
- SQLite schema migrations or data migration scripts
- Changes affecting workspace paths, platform sync directories, or project paths

Do **not** include proof-of-concept exploits or real sensitive data in PR descriptions
or commit messages. Report security vulnerabilities privately as described in
[SECURITY.md](SECURITY.md).

## Licensing

By submitting code to this project, you agree that it will be licensed under the
Apache License, Version 2.0. Every commit message should include a
`Signed-off-by` line indicating your agreement:

```
Signed-off-by: Jane Doe <jane@example.com>
```

You can configure Git to add this automatically:

```bash
git config --global commit.template ~/.gitmessage.txt
```

Then add to `~/.gitmessage.txt`:

```
<subject>

<body>

Signed-off-by: Your Name <your@email.com>
```

## Code Style

### TypeScript / React

- Prefer explicit function signatures with TypeScript types
- Keep components focused on composition; extract complex presentation logic
  into model functions or custom hooks
- Reuse existing design tokens, layout patterns, and page density rules
- Avoid unnecessary defensive wrapping; keep implementations straightforward

### Rust

- Keep the Tauri command layer thin; delegate business logic to `store/` modules
- Business logic in `store/` should not depend on the Tauri `AppHandle` or `State`
- Use `#[derive(...)]` macros consistently for serialization and error types
- Run `cargo fmt` before committing

### Tests

- Test behavior and boundaries, not internal implementation details
- Integration tests for file system and SQLite operations are in `src-tauri/tests/`
- Frontend tests use Vitest and Testing Library in `src/**/*.test.tsx`

## Documentation

- User-facing documentation belongs in `README.md`
- Architecture and design decisions belong in `docs/ARCHITECTURE.md`
- Update `CHANGELOG.md` when your change affects users
- API or data format changes should include migration notes
