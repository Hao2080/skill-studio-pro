# Skill Studio Release Notes / 发布说明

本次 Release 是跨平台预发布版本，面向 Windows、macOS 和 Linux。
This prerelease ships desktop builds for Windows, macOS, and Linux.

## 包含内容 / Included assets

| 平台 / Platform | 主要安装包 / Primary installers | 辅助文件 / Supporting files |
|---|---|---|
| Windows | `.msi`、`.exe` | `latest.json`、`*.sig`、`sha256sums-windows.txt` |
| macOS | `.dmg`、`.tar.gz` | `latest.json`、`*.sig`、`sha256sums-macos.txt` |
| Linux | `.AppImage`、`.deb`、`.rpm` | `latest.json`、`*.sig`、`sha256sums-linux.txt` |

`latest.json` 和 `*.sig` 是自动更新所需的元数据与签名文件，不是手动安装包。
`sha256sums-*.txt` 用于校验下载文件完整性。

## 下载与校验 / Download and verification

1. 先选择与你系统匹配的主安装包。
2. 再对照同一 Release 中的 SHA256 校验文件核对下载结果。
3. 如需自动更新，请保留同一 Release 中的 `latest.json` 和签名文件。

1. Download the installer that matches your operating system.
2. Verify it against the SHA256 checksum file attached to the same release.
3. If you rely on auto-updates, keep the matching `latest.json` and signature files from the same release.

## 自动更新前提 / Auto-update prerequisites

- 先手动安装一个已包含 updater 的基线版本。
- CI 必须配置 `TAURI_SIGNING_PRIVATE_KEY`；如果私钥有密码，还需要 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。
- 预发布版本的更新链路依赖 GitHub Releases，请不要手动改动 `latest.json` 或签名文件。

- First install a baseline build that already includes the updater.
- CI must provide `TAURI_SIGNING_PRIVATE_KEY`; if the key is password-protected, also set `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- Preview releases depend on GitHub Releases for update metadata, so do not edit `latest.json` or signature files manually.

## 预发布限制 / Preview limitations

- Windows 安装包当前未做正式代码签名，可能出现未知发布者或 SmartScreen 提示。
- macOS 安装包当前未做签名与 notarization，首次打开可能需要用户手动确认。
- Linux 产物会按发行版选择不同格式，请优先选择与你系统匹配的包。
- 这是预发布说明页，不代表稳定版承诺；稳定版发布前，产物说明会继续补齐和收敛。

- Windows installers are not code-signed yet and may show unknown publisher or SmartScreen warnings.
- macOS installers are not signed or notarized yet and may require manual approval on first launch.
- Linux artifacts ship in multiple formats; choose the one that matches your distribution.
- This is a prerelease note page, not a stable-release guarantee. The packaging story will continue to be tightened before the first stable release.

## 说明 / Notes

- 每个平台的 release job 都会上传该平台的安装包、更新元数据和校验文件。
- GitHub Release 正文会引用这份文件，确保三个平台使用一致的说明口径。
- 如需更完整的功能背景和架构说明，请查看仓库中的 README 与 `docs/ARCHITECTURE.md`。

- Each platform release job uploads the installer, update metadata, and checksum files for that platform.
- The GitHub Release body is sourced from this file so all platforms share the same release wording.
- For broader product context and architecture notes, see the repository README and `docs/ARCHITECTURE.md`.
