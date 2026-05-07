# Release Guide

This guide documents how Skill Studio releases are built and published.

## Release Model

- Versioned releases are created from Git tags matching `v*`.
- GitHub Actions builds platform-specific Tauri installers on Windows, macOS, and Ubuntu runners.
- Release assets are attached to GitHub Releases, not committed to the repository.
- `docs/release-notes.md` is used as the shared release body.

## Required Secrets

Configure these as repository secrets under `Settings -> Secrets and variables -> Actions -> Repository secrets`.

| Secret | Purpose |
|--------|---------|
| `TAURI_SIGNING_PRIVATE_KEY` | Private key used to sign updater artifacts |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the private key, if the key is encrypted |

Do not store signing keys in the repository. The public updater key belongs in `src-tauri/tauri.conf.json`.

## Version Checklist

Before publishing a release:

1. Update `package.json`.
2. Update `src-tauri/Cargo.toml`.
3. Update `src-tauri/tauri.conf.json`.
4. Update `CHANGELOG.md`.
5. Run the validation suite.

```bash
npm run check
```

## Publish

Create and push an annotated tag from the commit you want to release.

```bash
git tag -a v0.1.0 -m "Skill Studio v0.1.0 prerelease"
git push origin v0.1.0
```

The `Release` workflow creates the GitHub Release and uploads platform artifacts.

## Expected Assets

| Platform | Installers | Supporting files |
|----------|------------|------------------|
| Windows | `.exe`, `.msi` | `latest.json`, `*.sig`, `sha256sums-windows.txt` |
| macOS | `.dmg`, `.tar.gz` | `latest.json`, `*.sig`, `sha256sums-macos.txt` |
| Linux | `.AppImage`, `.deb`, `.rpm` | `latest.json`, `*.sig`, `sha256sums-linux.txt` |

`latest.json` and `*.sig` are updater files. Users should download the installer that matches their platform and verify it with the matching checksum file.

## Rebuilding a Release

If a tag points at the wrong commit or the release assets need to be regenerated:

1. Delete the GitHub Release.
2. Delete the remote tag.
3. Delete or recreate the local tag at the intended commit.
4. Push the tag again.

```bash
gh release delete v0.1.0 --yes
git push origin --delete v0.1.0
git tag -d v0.1.0
git tag -a v0.1.0 -m "Skill Studio v0.1.0 prerelease"
git push origin v0.1.0
```

Only rebuild prereleases or releases that have not been broadly consumed. For public stable releases, prefer publishing a new patch version.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Tauri build reports a public key but no private key | `TAURI_SIGNING_PRIVATE_KEY` is missing | Add the private key content as a repository secret |
| Signing fails with password error | Private key password is missing or wrong | Add or update `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` |
| Release assets are missing for one platform | The platform job failed before upload | Open the failed job log and rerun failed jobs after fixing the cause |
| `latest.json` is missing | Updater artifact generation was not included | Check `includeUpdaterJson` in the release workflow |

## Preview Release Limits

- Windows installers are not code-signed yet and may show unknown publisher or SmartScreen warnings.
- macOS installers are not signed or notarized yet and may require manual approval on first launch.
- Users must manually install one updater-enabled baseline build before automatic updates can work.
