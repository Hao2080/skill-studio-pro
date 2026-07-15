<p align="center">
  <img src="./public/assets/brand/skill-studio-pro-wordmark-placeholder.svg" alt="Skill Studio Pro" width="900" />
</p>

<p align="center">

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC107?logo=tauri)](https://v2.tauri.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-stable-CE422B?logo=rust)](https://www.rust-lang.org)

</p>

# Skill Studio Pro

Skill Studio Pro 是一个本地优先、跨平台的 AI Agent Skill 资产管理桌面应用。本仓库当前处于 Wave 0 项目基线阶段：保留并验证上游已有的工作区、Skill 管理、快照、市场、平台、项目和团队兼容能力，同时建立 Pro 独立命名、数据目录、品牌占位、更新隔离和跨平台 CI。

Wave 0 不实现扫描索引、AI、中央映射、安装计划或回收站等 Pro 新业务功能；这些能力将由后续模块在本基线上开发。

## 与上游 Skill Studio 的关系

Skill Studio Pro 基于开源项目 [liu673/skill-studio](https://github.com/liu673/skill-studio) 改造。

- 上游审计基线：[`cd0bb0af53865d4a9643968080bfc5a8137b72d9`](https://github.com/liu673/skill-studio/commit/cd0bb0af53865d4a9643968080bfc5a8137b72d9)
- 上游作者与贡献者版权、Apache-2.0 `LICENSE` 和 `NOTICE` 均予以保留
- Git remote `upstream` 指向原仓库，便于审计和后续同步
- Pro 的 npm package、Rust crate、二进制、Tauri identifier、数据目录和品牌资产与上游隔离

完整产品范围与技术约束见 [SPEC](docs/SPEC.md)、[PRD](docs/PRD.md)、[技术方案](docs/TECHNICAL-DESIGN.md) 和 [自动化测试方案](docs/AUTOMATED-TESTING.md)。

## 当前基线

| 项目 | 值 |
|---|---|
| 产品名称 | Skill Studio Pro |
| npm package | `skill-studio-pro` |
| Rust package / binary | `skill-studio-pro` |
| Rust library crate | `skill_studio_pro_lib` |
| Tauri identifier | `app.skillstudiopro` |
| 默认工作区 | `~/.skill-studio-pro/` |
| 技术栈 | Tauri 2、React 18、TypeScript、Rust、SQLite |

## 品牌与更新

Wave 0 使用 `public/assets/brand/` 中的独立 Pro 占位资产，不将上游 Logo 作为正式 Pro 品牌。占位资产将在后续品牌工作流中替换。

自动更新当前明确停用：仓库不包含上游更新端点、公钥或 updater capability，也不生成 updater artifacts。在建立独立 Pro 发布仓库、签名密钥和更新源之前，请勿启用自动更新。上游 Release 安装包不是 Skill Studio Pro 安装包。

## 从源码运行

环境要求：Node.js 22、Rust stable、Git，以及目标平台所需的 [Tauri 系统依赖](https://v2.tauri.app/start/prerequisites/)。

```bash
npm ci
npm run tauri dev
```

## 验证命令

```bash
npm run typecheck
npm run test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
npm run check
```

GitHub Actions 在 Windows、macOS 和 Linux 上运行同一套基线检查。CI 不调用真实 AI Provider，也不应包含 API Key、数据库、日志或本地 Skill。

## 本地数据与安全

- Pro 默认数据目录为 `~/.skill-studio-pro/`，不会自动复用或覆盖上游 `~/.skill-studio/`
- 导入的 Skill 不会因扫描或展示而自动执行
- 市场浏览和 Git 导入可能产生用户主动触发的网络请求
- `.gitignore` 排除本地数据库、日志、回收站、凭据文件、本地 Skill 和构建产物
- 安全问题请按 [SECURITY.md](SECURITY.md) 负责任披露

## 许可证与归属

Skill Studio Pro 继续采用 **Apache License 2.0**。请参阅 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。

本衍生项目保留 Skill Studio 的作者、贡献者、版权声明和上游归属。第三方平台名称与标识归各自所有者所有，仅用于识别和互操作，不表示认可或赞助。
