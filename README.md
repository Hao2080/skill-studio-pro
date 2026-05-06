<p align="center">
  <img src="./public/assets/logo/logo-horizontal.png" alt="Skill Studio" width="900" />
</p>

<p align="center">

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC107?logo=tauri)](https://v2.tauri.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-1.75+-CE422B?logo=rust)](https://www.rust-lang.org)
[![Build Status](https://img.shields.io/github/actions/workflow/status/liu673/skill-studio/ci.yml?branch=main)](https://github.com/liu673/skill-studio/actions)

</p>

---

# Skill Studio

Skill Studio 是一个本地优先的桌面端 Skill 资产管理工具，用于创建、导入、组织、版本化、对比和同步 AI Agent 技能。它把个人 Skill 工作区、版本快照、外部市场、平台目录、项目空间和团队交付流程整合到同一个应用中，让 Skill 从散落的本地文件变为可追踪、可回滚、可复用、可交付的资产。

支持的平台包括 Cursor、Claude Code、Codex、Windsurf、Roo Code 等 45+ 种 Agent 平台。

> **当前状态**：v0.1.0 正在筹备开源发布，稳定版本即将发布。

## 截图

<p align="center">
  <img src="docs/assets/screenshots/dashboard.png" alt="总览" width="100%" />
  <br><em>总览</em>
</p>

<p align="center">
  <img src="docs/assets/screenshots/skills-workspace.png" alt="技能资产" width="100%" />
  <br><em>技能资产</em>
</p>

<p align="center">
  <img src="docs/assets/screenshots/skill-detail.png" alt="技能详情" width="100%" />
  <br><em>技能详情</em>
</p>

<p align="center">
  <img src="docs/assets/screenshots/version-compare.png" alt="版本对比" width="100%" />
  <br><em>版本对比</em>
</p>

<p align="center">
  <img src="docs/assets/screenshots/market.png" alt="市场" width="100%" />
  <br><em>市场</em>
</p>

<p align="center">
  <img src="docs/assets/screenshots/platform-center.png" alt="平台中心" width="100%" />
  <br><em>平台中心</em>
</p>

<p align="center">
  <img src="docs/assets/screenshots/project-workspace.png" alt="项目空间" width="100%" />
  <br><em>项目空间</em>
</p>

<p align="center">
  <img src="docs/assets/screenshots/team-space.png" alt="团队空间" width="100%" />
  <br><em>团队空间</em>
</p>

---

## 目录

- [功能概览](#功能概览)
- [截图](#截图)
- [快速上手](#快速上手)
- [核心概念](#核心概念)
- [支持的平台](#支持的平台)
- [技术架构](#技术架构)
- [本地开发](#本地开发)
- [构建安装包](#构建安装包)
- [安全说明](#安全说明)
- [参与贡献](#参与贡献)
- [许可证](#许可证)

- [功能概览](#功能概览)
- [快速上手](#快速上手)
- [核心概念](#核心概念)
- [支持的平台](#支持的平台)
- [技术架构](#技术架构)
- [本地开发](#本地开发)
- [构建安装包](#构建安装包)
- [安全说明](#安全说明)
- [参与贡献](#参与贡献)
- [许可证](#许可证)

---

## 功能概览

| 模块 | 能力 |
|---|---|
| **总览** | 个人 Skill、快照、团队待处理事项和核心资产状态一览。 |
| **技能资产** | 创建、导入、搜索、分类、打标签、批量整理 Skill。 |
| **技能详情** | 浏览文件树、读取和编辑文件、打开外部编辑器、打开所在目录。 |
| **版本快照** | 创建快照、查看历史、对比版本差异、恢复工作副本、设置生效版本。 |
| **市场与导入** | 从本地目录、Git 仓库、内置模板和外部 Skill 市场导入资产。 |
| **平台中心** | 检测 Agent 平台目录，配置同步目录和同步模式。 |
| **项目空间** | 为项目绑定 Skill 和平台目录，生成同步计划，执行项目级同步。 |
| **团队空间** | 团队 Skill 库、提交、差异评审、合并、推荐版本和拉取。 |
| **系统设置** | 主题、语言、发布前恢复点、快照保留上限、数据目录配置。 |

---

## 快速上手

### 安装

从 [Releases](https://github.com/liu673/skill-studio/releases) 页面下载对应平台的预构建安装包。

> **说明**：每个 release 的正文都会列出各平台安装包、校验文件、自动更新前置条件和预发布限制；详细模板见 [docs/release-notes.md](docs/release-notes.md)。

> **说明**：当前预构建安装包按未签名预览版发布。Windows 和 macOS 可能出现系统安全提示。安装带自动更新能力的基线版本后，后续版本可在应用内检查更新。下载后请对照 Release 附带的 SHA256 校验文件确认文件完整性。

### 从源码构建

```bash
# 环境要求：Node.js 18+、Rust 1.75+、Git、Tauri 系统依赖
git clone https://github.com/liu673/skill-studio.git
cd skill-studio
npm install
npm run tauri dev
```

### 验证命令

```bash
npm run check   # 全量校验
npm test        # 仅前端测试
```

---

## 核心概念

| 概念 | 说明 |
|---|---|
| **Skill** | 可被 Agent 使用的能力包，通常包含 `skill.md` 和相关文件。 |
| **工作副本** | 当前正在编辑的 Skill 文件目录。可能尚未保存为稳定版本。 |
| **快照** | 某时间点的完整 Skill 目录副本，带序号、变更摘要和修订哈希。 |
| **生效版本** | 当前被认定为可发布、可同步、可交付的快照版本。 |
| **来源记录** | Skill 的来源信息：手动创建、本地导入、Git 导入、市场导入或平台扫描。 |
| **平台连接** | 某 Agent 平台的 Skill 目录配置（如 Cursor、Claude Code、Codex）。 |
| **项目空间** | 面向具体项目的 Skill 编排和平台同步范围。 |
| **团队版本** | 团队库中的稳定 Skill 版本，可评审、推荐和拉取。 |

---

## 支持的平台

Skill Studio 内置了 45+ 种 Agent 平台的目录识别规则，并支持自定义平台。内置平台包括：

```
Cursor · Claude Code · Codex · OpenCode · Antigravity · Amp · Kilo Code ·
Roo Code · Goose · Gemini CLI · GitHub Copilot · OpenClaw · Droid ·
Windsurf · TRAE IDE · Cline · Deep Agents · Firebender · Kimi Code CLI ·
Replit · Warp · Augment · IBM Bob · CodeBuddy · Command Code · Continue ·
Cortex Code · Crush · iFlow CLI · Junie · Kiro CLI · Kode · MCPJam ·
Mistral Vibe · Mux · Neovate · Pochi · Qoder · Qwen Code · TRAE CN ·
Zencoder · AdaL · Hermes Agent
```

平台同步默认采用目录复制模式，也支持符号链接模式（适用于支持该功能的平台）。

---

## 技术架构

前端模块布局、Rust 后端分层、数据存储和关键设计决策详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

```
┌─────────────────────────────────────────┐
│           Desktop Shell (Tauri 2)       │
│  ┌───────────────┐   ┌───────────────┐  │
│  │  React 前端    │  │  Rust 后端     │  │
│  │  TypeScript   │◄──┼──────────────►│  │
│  │   Tauri IPC   │   │  SQLite / FS  │  │
│  └───────────────┘   └───────────────┘  │
└─────────────────────────────────────────┘
```

---

## 本地开发

### 环境要求

- Node.js 18 或更高版本
- Rust 1.75 或更高版本
- Git
- 平台构建工具（参考 [Tauri 官方文档](https://v2.tauri.app/start/prerequisites/)）

Ubuntu / Debian 系统安装 Tauri 依赖：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
sudo apt update
sudo apt install -y \
  pkg-config libwebkit2gtk-4.1-dev libxdo-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev fonts-noto-cjk
```

### 安装和运行

```bash
npm install
npm run tauri dev        # 完整桌面应用
npm run dev              # 仅前端（无桌面功能）
```

### 验证命令

| 命令 | 检查内容 |
|---|---|
| `npm run typecheck` | TypeScript 类型编译 |
| `npm test` | 前端测试（Vitest） |
| `npm run build` | 前端生产构建 |
| `npm run rust:fmt` | Rust 格式检查 |
| `npm run rust:check` | Rust 编译检查 |
| `npm run rust:test` | Rust 测试 |
| `npm run check` | 全部校验 |

---

## 构建安装包

```bash
npm run tauri build
```

当前 `bundle.targets` 设为 `all`，在当前平台构建。如需跨平台发布，请在对应操作系统上分别构建。

| 平台 | 产物 |
|---|---|
| Windows | `.msi`、`.exe` 安装包 |
| macOS | `.dmg`（未签名预览版可能触发 Gatekeeper 提示） |
| Linux | `.AppImage`、`.deb`、`.rpm` |

> **安装包说明**：每个 release 产物应附带 SHA256 校验文件。
> Release 正文会同步说明平台安装包、更新元数据和签名文件；正文模板见 [docs/release-notes.md](docs/release-notes.md)。
> 生成脚本见 `scripts/generate_checksums.sh` 和 `scripts/generate_checksums.ps1`。

### 预览版发布限制

- Windows 安装包暂未代码签名，可能显示“未知发布者”或 SmartScreen 警告。
- macOS 安装包暂未签名和 notarization，首次打开可能需要用户手动确认。
- 首次使用自动更新前，需要先手动安装一个已经内置 updater 的基线版本。
- Release 产物需附带 SHA256 校验文件，用于验证下载文件完整性。

### 自动更新发布要求

- `src-tauri/tauri.conf.json` 中已配置 GitHub Releases 更新端点。
- Release 构建需要 GitHub Secrets：`TAURI_SIGNING_PRIVATE_KEY`，若私钥设置了密码，还需要 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。
- 发布时必须同步提升 `package.json`、`src-tauri/Cargo.toml` 和 `src-tauri/tauri.conf.json` 版本号。
- 旧版本若未内置 updater，无法自动升级到新版本，需要用户手动安装一次基线版本。

---

## 安全说明

- **默认纯本地存储**：所有数据保存在 `~/.skill-studio/`，不依赖任何云服务
- **网络访问受限**：仅市场浏览和 Git 导入产生出站网络请求
- **不自动执行**：导入的 Skill 作为文件存储，不会被自动执行
- **同步由用户主导**：仅向用户明确配置的目录写入文件

完整安全政策、支持版本和漏洞报告流程见 [SECURITY.md](SECURITY.md)。

---

## 参与贡献

欢迎提交贡献。提交前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。要点如下：

- 提交 Pull Request 前运行 `npm run check`，确保全部校验通过
- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范
- 新增功能请附带测试用例
- 安全漏洞请私下报告，不要在公开 issue 中描述（参见 [SECURITY.md](SECURITY.md)）

---

## 许可证

Skill Studio 采用 **Apache License 2.0** 开源许可。详见 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。

---

## 商标声明

Skill Studio 为项目名称及商标。应用中提及的第三方平台名称和标识（如 Cursor、Claude Code、Codex、Windsurf 等）为其各自所有者所有，仅用于识别和互操作，不构成对这些所有者的任何形式的认可或推荐。
