# Architecture

本文档介绍 Skill Studio 的技术架构和各层职责。

## Overview

Skill Studio 是一个基于 Tauri 2 的桌面应用，采用前后端分离的架构：

```
┌─────────────────────────────────────────────┐
│              Desktop Shell (Tauri 2)        │
│                                             │
│  ┌─────────────────┐   ┌──────────────────┐ │
│  │  React Frontend │   │   Rust Backend   │ │
│  │                 │   │                  │ │
│  │  UI Components  │   │  Tauri Commands  │ │
│  │  State/Model    │◄──┼─────────────────►│ │
│  │  Tauri IPC      │   │  SQLite / FS     │ │
│  └─────────────────┘   └──────────────────┘ │
│         localhost IPC (invoke / events)     │
└─────────────────────────────────────────────┘
```

- **前端**：React 18 + TypeScript + Vite，负责所有 UI 渲染和用户交互
- **后端**：Rust（Tauri 2），负责文件系统操作、SQLite 数据库、网络请求和桌面集成
- **通信**：Tauri IPC（`invoke` 命令调用 + `emit` 事件推送）

## Frontend

```
src/
  app/               应用装配层：Provider、路由、全局布局
  features/          按业务域拆分的功能模块
    dashboard/       总览
    skills/          技能资产、详情、文件浏览
    snapshots/       版本快照、历史、差异对比
    market/          市场发现、导入
    platforms/       平台连接、同步配置
    projects/        项目空间、同步计划
    teams/           团队库、提交、合并、拉取
    settings/        主题、语言、数据目录
  shared/            跨域复用：Tauri 调用封装、通用组件、工具函数
  styles/            全局样式、设计 token
  types/             前端领域类型定义
```

### 前端模块职责

| 模块 | 职责 |
|---|---|
| `features/skills` | Skill 的增删改查、分类、标签、文件浏览、外部编辑器 |
| `features/snapshots` | 快照创建、历史查询、版本对比（diff） |
| `features/market` | 外部 Skill 市场聚合、本地/Git 导入、模板选择 |
| `features/platforms` | Agent 平台扫描、目录识别、同步配置 |
| `features/projects` | 项目绑定 Skill 与平台目录、生成和执行同步计划 |
| `features/teams` | 团队版本库、提交评审、差异合并、拉取 |
| `shared` | 所有 Tauri command 调用封装在此，避免业务组件直接依赖 IPC |

### State 管理

前端不引入 Redux/Zustand 等状态管理库，使用 React Context + localStorage 组合：

- `localStorage` 持久化用户偏好（分类、标签、主题、语言）
- React Context 提供运行时共享状态（如当前选中 Skill）
- 各 `features` 内部自行管理组件级状态

## Backend (Rust)

```
src-tauri/src/
  main.rs            二进制入口，调用 lib::run()
  lib.rs             库入口，注册所有 Tauri 命令
  commands/          Tauri 命令入口，按领域拆分
    skills.rs        技能 CRUD、文件操作
    snapshots.rs     快照创建、查询、恢复
    market.rs        外部市场数据拉取、导入
    platforms.rs     平台扫描、目录识别、同步
    projects.rs      项目管理、同步计划
    teams.rs         团队库、提交、合并、拉取
    files.rs         文件读写、目录操作
    settings.rs      设置读取和写入
    health.rs        健康检查
    organization.rs  组织（分类、标签）管理
  db/                SQLite 操作层
    init.rs          schema 初始化和迁移
    skills.rs        技能元数据表操作
    snapshots.rs     快照元数据表操作
    projects.rs      项目表操作
    teams.rs         团队表操作
  store/             业务逻辑层，按领域拆分
    files.rs         文件系统操作：创建、复制、删除、恢复
    import.rs        导入逻辑：本地目录、Git 仓库、市场模板
    platform.rs      平台识别和同步逻辑
    project.rs       项目同步计划生成和执行
    settings.rs      设置读写
    description.rs  Skill 描述解析
    common.rs        通用工具（哈希计算、路径规范化）
    organization.rs  分类和标签管理
  workspace/         工作区路径管理
    paths.rs         路径常量和规范化函数
    config.rs        工作区配置文件读写
  snapshot/         快照逻辑：创建快照目录、记录元数据、恢复
  team/             团队协作逻辑：提交、差异、合并、拉取
    submissions.rs  提交管理
    diff.rs / diffs.rs  文件差异计算
    pull.rs         拉取逻辑
    delivery.rs     交付和推荐版本
    permissions.rs  权限检查
    file_browser.rs  文件浏览器
    crud.rs         团队库 CRUD
    sql.rs          团队库 SQL 查询
    activity.rs     活动记录
  market/           市场数据适配层
    common.rs       通用 HTTP 客户端（reqwest）
  diff.rs           文本差异计算封装（similar 库）
  domain.rs         领域模型：Skill、Snapshot、Platform 等核心类型
```

### Rust 模块分层

```
commands/  (Tauri IPC 入口)
    │
    ▼
store/  (业务逻辑层：协调 db 和 filesystem)
    │
    ├──▶ db/  (数据持久化：SQLite)
    │
    └──▶ workspace/  (文件系统：工作区路径)
```

所有命令入口不直接操作数据库或文件系统，通过 `store/` 模块中转，确保职责清晰。

## Data Storage

用户数据存储在本地，默认目录：

```
~/.skill-studio/
  workspace.json     工作区清单
  metadata.db        SQLite 元数据
  settings.json      应用设置
  skills/            当前工作副本
  snapshots/         快照目录
  projects/          项目空间数据
  imports/          导入缓存
  staging/          临时处理区
  logs/             同步日志
  team/
    versions/       团队版本快照
    staging/        团队提交暂存区
```

元数据使用 SQLite，应用设置使用 JSON 文件，Skill 文件以原始目录形式存储在工作区。

## Key Design Decisions

### 1. 本地优先

所有数据默认保存在本机 `~/.skill-studio/`。外部市场浏览和 Git 导入会访问网络，但不依赖任何云服务。

### 2. 无内置状态管理库

前端通过 React Context + localStorage 管理状态，减少外部依赖，降低包体积。

### 3. Rust 业务逻辑与 Tauri 命令分离

`store/` 模块包含纯业务逻辑（不依赖 Tauri Runtime），`commands/` 只负责接收 IPC 调用、参数校验和返回值序列化。这样便于在不启动 Tauri 的情况下对业务逻辑进行单元测试。

### 4. 快照以目录形式存储

每次快照保存完整目录副本（而非增量），简化恢复逻辑，避免快照损坏导致无法回滚。

### 5. 外部导入视为不可信

Git 仓库导入和外部市场导入的内容不自动执行。平台同步只写入用户明确配置的目录。
