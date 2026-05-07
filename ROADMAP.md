# Roadmap

This roadmap describes the near-term direction for Skill Studio. It is intentionally conservative: items listed here are product commitments we can explain, test, and maintain.

## Current Focus

- Stabilize the cross-platform preview release for Windows, macOS, and Linux.
- Make Skill import, versioning, comparison, and platform sync predictable for local-first workflows.
- Improve trust signals for third-party Skills before broad marketplace-style usage.
- Tighten packaging, update metadata, and release documentation.

## v0.1.x Preview

- Keep release artifacts available for Windows, macOS, and Linux.
- Fix CI and release workflow noise so contributors can trust the Actions status.
- Improve first-run guidance for unsigned preview installers.
- Expand regression coverage around Skill import, snapshot creation, restore, and sync planning.
- Narrow file-system permissions to the minimum needed by the desktop app.

## Before v0.2.0

- Add clearer provenance metadata for imported Skills.
- Improve diff review and restore flows for larger Skill directories.
- Refine platform detection for less common Agent tools.
- Add release smoke checks for generated installers and updater metadata.
- Document privacy and local-data behavior in a dedicated policy.

## Before Stable Release

- Complete Windows code signing and macOS notarization.
- Define a stable update channel and a preview channel.
- Publish a compatibility matrix for supported Agent platforms.
- Add migration notes for data directory and snapshot format changes.
- Harden backup, restore, and rollback behavior for team workflows.

## Not Planned Yet

- Hosted cloud sync as a default dependency.
- Executing imported Skill code automatically.
- A centralized public Skill marketplace operated by this repository.
- Replacing existing Agent platform package formats.

## Feedback

Use GitHub Issues for reproducible bugs and concrete feature requests. Use Discussions for broader workflow feedback once repository discussions are enabled.
