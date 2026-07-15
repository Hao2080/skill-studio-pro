<p align="center">
  <img src="./public/assets/brand/skill-studio-pro-wordmark.svg" alt="Skill Studio Pro" width="900" />
</p>

<p align="center">
  <a href="https://github.com/Hao2080/skill-studio-pro/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Hao2080/skill-studio-pro/actions/workflows/ci.yml/badge.svg?branch=main" /></a>
  <a href="https://github.com/Hao2080/skill-studio-pro/releases/tag/v0.1.0-beta.1"><img alt="Public Beta" src="https://img.shields.io/badge/release-v0.1.0--beta.1-38bdf8" /></a>
  <a href="LICENSE"><img alt="Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-blue" /></a>
</p>

# Skill Studio Pro

Skill Studio Pro 是一个本地优先的开源桌面应用，用来发现、理解和安全管理分散在多个 AI Agent 中的 Skill。它把外部实例与中央主副本分开，提供来源证据、快照、编辑、多 Agent 发布、漂移治理、回收站以及可选的 AI 摘要。

[English README](README_en.md)

![Skill Studio Pro Windows release UAT，使用隔离夹具和空工作区](docs/assets/skill-studio-pro-windows.png)

> 上图来自 Windows release/NSIS 的隔离 UAT：1280×800 逻辑窗口、150% DPI，不含用户 Skill、真实凭据或个人路径。

## Public Beta 能做什么

- 扫描 Codex、Claude Code、Cursor、Windsurf、Gemini CLI，以及自定义根目录；首次扫描只建索引，不移动或修改外部文件。
- 展示原始 `SKILL.md`、文件树、风险提示、重复关系、来源证据和确定性可信度；可信度不是安全评分。
- 把外部实例纳入唯一中央主副本，创建快照，并以复制模式发布到一个或多个 Agent。
- 编辑中央库中的 Markdown、YAML、JSON、TOML 和纯文本；保存前建立恢复点，格式或写入失败时保留草稿。
- 检测发布目标漂移，要求用户明确取消、导入或覆盖；不会静默覆盖非受管目录。
- 默认把删除移入应用回收站；永久删除只能在回收站二次确认后执行。
- 按需调用 MiniMax/OpenAI 兼容 Provider 生成结构化用法与简介；显示实际 Provider、模型、职责、时间和过期状态。

完整需求、边界与测试映射见 [SPEC](docs/SPEC.md)、[PRD](docs/PRD.md)、[技术方案](docs/TECHNICAL-DESIGN.md) 和 [自动化测试](docs/AUTOMATED-TESTING.md)。

## 安装 Public Beta

从 [v0.1.0-beta.1 Release](https://github.com/Hao2080/skill-studio-pro/releases/tag/v0.1.0-beta.1) 下载与你系统匹配的产物，并使用同一 Release 的 `SHA256SUMS.txt` 校验：

| 平台 | 产物 | Beta 边界 |
|---|---|---|
| Windows x64 | NSIS `*-setup.exe` | 未做 Authenticode 代码签名，可能显示未知发布者或 SmartScreen 提示 |
| macOS | `.dmg` | 未做 Developer ID 签名或公证，首次打开可能需要在系统设置中手动允许 |
| Linux x64 | `.deb`、`.AppImage` | 未做发行版包签名；持久凭据需要可用且已解锁的 Secret Service |

所有安装包均由真实 Windows/macOS/Linux GitHub-hosted runner 构建。CI 会安装或挂载产物、实际启动桌面进程、观察隔离工作区 bootstrap，并保存 smoke 与原生 Secret Store 契约日志。自动更新保持关闭，因此 Beta 不会静默下载或安装新版本。

## 从源码构建

需要 Node.js 22、Rust stable、Git 和目标平台的 [Tauri 2 系统依赖](https://v2.tauri.app/start/prerequisites/)。

```bash
git clone https://github.com/Hao2080/skill-studio-pro.git
cd skill-studio-pro
npm ci
npm run tauri dev
```

构建当前平台安装包：

```bash
npm run check
npm run supply-chain:check
npm run tauri -- build --ci
```

关键质量门可单独运行：

```bash
npm run typecheck
npm run test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
npm run security:repo
```

## 数据目录与隐私

默认工作区为 `~/.skill-studio-pro/`，与上游 `~/.skill-studio/` 隔离。工作区包含 SQLite 索引、中央 Skill、快照、回收站、staging、日志和 AI 缓存，但不包含持久化 API Key。

- 默认不上传 Skill 内容，也不收集遥测。
- 扫描、查看、编辑、发布和回收站在离线状态下可用。
- 只有用户主动生成 AI 内容或显式启用自动补充后，才向选定 Provider 发送当前任务所需的最少内容。
- API Key 持久保存到 Windows Credential Manager、macOS Keychain 或 Linux Secret Service；不可用时不会回退到 SQLite、JSON 或明文文件。用户也可选择仅当前进程使用。
- 导入的 Skill 被视为不可信内容；扫描、预览和摘要不会执行其中的脚本、命令或 Hook。

## 配置 MiniMax 与 OpenAI

进入“模型与 API”，分别设置 Provider 地址、模型 ID、职责、超时和凭据，然后手动执行连接测试。默认路由由 MiniMax 负责结构化采集、OpenAI 负责最终提炼，但全部可配置或关闭。没有凭据、网络失败、限流或 Provider 不可用都不会阻断本地核心功能。

CI 只使用 loopback Mock Provider，不访问真实付费端点。Public Beta 的真实 Provider 可用性取决于用户配置、服务商兼容性与账户权限，不作为发行包的隐含承诺。

## 安全边界

- 高风险写入使用计划、源/目标 hash、允许根校验、staging、原子替换和恢复路径。
- 发布默认使用复制；符号链接只有在平台和权限实际支持时才可用，失败不会静默降级。
- 非受管目标、所有权标记不匹配、路径穿越、Zip Slip 和越界链接会被拒绝。
- 本项目无法替用户证明第三方 Skill “绝对安全”；请先审阅原文、脚本、来源和依赖。

漏洞请按 [SECURITY.md](SECURITY.md) 使用 GitHub Private Vulnerability Reporting 报告。贡献要求见 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

## SBOM、许可证与归属

Release 附带前端、Rust 和合并后的 CycloneDX 1.6 JSON SBOM、机器可读许可证清单以及 [第三方依赖/资产清单](docs/THIRD-PARTY-NOTICES.md)。锁文件、SBOM 可复现性、未知许可证、强 copyleft、密钥模式和仓库卫生均由 CI 阻断检查。

Skill Studio Pro 采用 Apache-2.0，并基于 [liu673/skill-studio](https://github.com/liu673/skill-studio) 的 [`cd0bb0af53865d4a9643968080bfc5a8137b72d9`](https://github.com/liu673/skill-studio/commit/cd0bb0af53865d4a9643968080bfc5a8137b72d9) 改造。上游作者、完整历史、[LICENSE](LICENSE)、[NOTICE](NOTICE) 与必要归属均予保留；`upstream` remote 继续指向原仓库，Pro `origin` 独立发布。

## 已知限制与故障排查

- 当前安装包均不是面向生产分发的身份签名包；macOS 未公证，自动更新未配置。
- Windows 无创建符号链接权限时会返回系统错误；改用默认复制模式，或由用户自行启用合适的系统权限。
- Linux 无已解锁 Secret Service 时不能持久保存凭据；可修复桌面密钥环，或选择仅当前进程使用。
- WebView 空白或应用启动失败时，先确认 Tauri 系统依赖/WebView 运行时，再从终端启动以保留错误日志。
- 数据目录不可写时，检查 `~/.skill-studio-pro/` 权限；不要手工删除正在使用的 SQLite、staging 或 journal。
- 校验下载：`sha256sum -c SHA256SUMS.txt`；PowerShell 可用 `Get-FileHash <file> -Algorithm SHA256` 与 manifest 对照。

Beta 的完整变更和边界见 [CHANGELOG.md](CHANGELOG.md) 与 [Release Notes](docs/release-notes.md)。
