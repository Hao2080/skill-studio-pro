# Skill Studio Pro Inventory Index 交接

状态：`HANDOFF_READY`
完成日期：2026-07-15
工作目录：`E:\AIHHao_Data\Codex_Xiangmu\Skills-All-in`

## 1. 分支和 commit

- 分支：`wave-0-baseline`
- 已验证的实现 commit：`95f3a235e74bb0b1e46e6c741524845759277ef4`
- 交接文档在实现 commit 后单独提交；最终文档 commit 以交付时 `git rev-parse HEAD` 为准。
- 实现范围仅包含 inventory/origin 后端、数据库、IPC、前端 API/类型/Mock 契约和相关测试；没有修改 UI 页面或视觉样式。

## 2. 数据表和迁移版本

SQLite `PRAGMA user_version` 当前为 `1`，`schema_migrations` 中记录：

| version | name |
|---:|---|
| 1 | `inventory_index_v1` |

新增表：

| 表 | 用途 |
|---|---|
| `scan_roots` | Agent、插件、项目、自定义和中央库扫描根配置 |
| `scan_runs` | 全量/增量扫描状态、进度、错误和取消结果 |
| `skill_instances` | 外部 Skill 实例、解析字段、双哈希、风险、重复、Git/manifest 摘要 |
| `skill_instance_files` | 可重建文件树的路径、类型、大小、mtime、哈希和风险摘要，不保存正文 |
| `source_evidence` | 结构化来源证据；自动证据重算时保留人工确认 |
| `source_resolutions` | 单实例确定性来源结论、0–100 分、状态、依据和证据哈希 |
| `schema_migrations` | 单调迁移记录 |

关键索引覆盖启用扫描根、扫描时间、根/last-seen、规范名/content hash、文件 hash、来源状态和可信度。外键关联保留既有 `skills` 表；实例文件和来源记录对实例使用级联删除。迁移不会降低高于当前值的 `user_version`。

## 3. IPC 命令和事件

已注册命令：

```text
inventory_root_list
inventory_root_upsert
inventory_scan_start
inventory_scan_cancel
inventory_instance_list
inventory_instance_get
origin_resolution_get
origin_resolution_confirm
origin_resolution_recalculate
```

`inventory_scan_start` 立即返回 `running` 的轻量 `ScanRun`，实际扫描在后台阻塞任务中完成；同一根不能被两个运行同时接管。`inventory_scan_cancel` 设置协作式取消令牌，最终进度状态为 `cancelled`。

事件：

| 事件 | 载荷 |
|---|---|
| `inventory://scan-progress` | run ID、状态、根总数/完成数、候选数、变化数、错误数、当前路径 |
| `inventory://instances-changed` | run ID 和受影响实例 ID 列表 |

事件不广播实例大对象。前端通过 `src/features/inventory/api/inventoryApi.ts` 查询详情，并可注入 `InventoryInvoker` 构造 Mock；类型位于 `src/features/inventory/model/`。

## 4. 扫描规则

1. 通过上游 `store/platform.rs` 的同一平台定义注册表投影扫描根，没有复制 Agent 路径常量。
2. 平台目录只有实际存在时才自动登记；自定义根允许先保存不存在的绝对路径，并在列表中返回 `available=false`。
3. 递归发现 `SKILL.md`；Windows 文件名比较不区分大小写，Unix 保持大小写语义。
4. `.system`、插件缓存和 Skill 内嵌套的第二个 `SKILL.md` 均作为独立实例；父 Skill 的内容哈希仍覆盖其完整子树。
5. 默认不遍历 `.git`、`node_modules`、`target`。最大深度 64、单根遍历条目 200,000；越限形成错误而不执行内容。
6. 扫描根符号链接/junction 被拒绝；遍历和 Skill 文件索引不跟随任何符号链接。链接文件仅登记 `symlink_skipped` 风险，不读取目标。
7. 外部目录只执行读取、metadata 和分块哈希；所有写入仅发生在应用 SQLite 索引。扫描不移动、重命名、覆盖、删除或执行 Skill 文件。
8. `SKILL.md` 元数据读取上限 2 MiB，Front Matter 上限 256 KiB；支持 UTF-8 BOM、CRLF、无 Front Matter、顶层及 `metadata.short-description`。无效 YAML/UTF-8 保存为单实例 `parse_status=error`。
9. 风险摘要包括脚本、可执行文件、符号链接、敏感文件名和依赖 manifest；扫描不会运行脚本、Git 命令或 Hook。
10. `skill_md_hash` 是原始 `SKILL.md` 字节 SHA-256。`content_hash` 按规范化相对路径排序，组合规则版本、文件类型、大小和分块 SHA-256；CRLF/LF 会产生不同原始内容哈希。
11. 增量扫描先比较按路径、类型、大小、mtime 生成的 quick signature；未变化实例只刷新 last-seen，变化实例才重解析和重算内容/来源。强制全量忽略 quick signature。
12. 完整根扫描结束后，上次存在但本次未见的实例设置 `missing_at`；取消扫描不标记缺失。单 Skill 读取/解析/哈希失败只增加错误并继续其他候选。
13. 文件监听提供 `WatcherAdapter`、`NotifyWatcherAdapter` 和确定性 `DebounceQueue`；重复路径事件在默认调用方指定的窗口内合并为 Skill 根。

## 5. 重复检测

按标准化名称和 `content_hash` 对所有未缺失实例批量重算，可同时携带多个关系：

- `same_name_same_content`
- `same_name_different_content`
- `same_content_different_name`

系统只标记关系，不自动合并或覆盖任何实例。

## 6. 来源证据和评分规则

本地收集器读取必要且有上限的 Git/JSON 元数据，不调用 shell：

- `.git/config` 的 `origin` remote
- `.git/HEAD` 和直接 ref 的 commit
- `.codex-plugin/plugin.json` 或 `plugin.json`
- `.system` 路径特征
- 上游已知 Agent 根路径

确定性规则版本：`origin-v1`。初始权重：

| 证据 | 权重 |
|---|---:|
| 用户确认 | 100，直接 `confirmed` |
| 应用安装记录入口 | +50 |
| Git remote/commit | +35 |
| 插件 manifest | +35 |
| 官方 `.system` 路径 | +30 |
| 已知 Agent 根 | +15 |
| 内容来源 URL 入口 | +10 |
| 名称弱匹配入口 | +5 |
| 强冲突 | -25/项 |
| 未验证 MiniMax 候选 | 0 |

自动分数截断到 0–99；85–99 为高、60–84 为中、1–59 为低、0 为 `unknown`。结论类型按用户确认、应用安装记录、Git、插件、系统路径、Agent 路径和弱证据顺序选择。评分依据和规则版本参与 `evidence_hash`。人工确认写成独立证据，后续自动重扫只替换自动证据，不覆盖人工结论。

`origin::evidence::minimax_candidate` 已为 MiniMax 候选预留 0 分证据入口；本模块不调用模型，也不会让未验证候选提升可信度。

## 7. Agent 路径支持

上游定义注册表当前投影 45 个内置平台。本次有专门契约覆盖的五个平台：

| Agent | 全局 Skill 路径 |
|---|---|
| Codex | `~/.codex/skills` |
| Claude Code | `~/.claude/skills` |
| Cursor | `~/.cursor/skills` |
| Windsurf | `~/.codeium/windsurf/skills` |
| Gemini CLI | `~/.gemini/skills` |

额外自动识别 Codex `~/.codex/plugins/cache` 和 Claude Code `~/.claude/plugins/cache`。其余平台继续通过同一上游定义注册表发现；用户可用 `root_type=custom` 和可选 `platform_name` 添加任意绝对路径。

## 8. 测试结果

最终聚合命令 `npm run check` 通过：

| 检查 | 结果 |
|---|---|
| `npm run typecheck` | 通过 |
| `npm run test` | 37 files；232 passed，2 skipped，0 failed |
| `npm run build` | 通过；Vite 6.4.3，3352 modules transformed |
| `cargo fmt --check` | 通过 |
| `cargo check` | 通过 |
| `cargo clippy --all-targets -- -D warnings` | 通过 |
| `cargo test` | 40 unit + 16 integration passed；性能基准 1 ignored，0 failed |

Inventory 覆盖：迁移和索引、五平台根、递归/`.system`/插件、BOM/CRLF/无效 YAML、双哈希、三类重复、只读扫描、脚本不执行、Git/manifest/path 证据、人工确认、取消、根互斥、增量仅更新变化实例、Windows 路径大小写/分隔符、符号链接循环/根拒绝、监听去抖和前端 IPC Mock 契约。

前端测试中的 jsdom `getComputedStyle(... pseudo-elements)` 为既有环境提示，不影响通过状态。

## 9. 性能数据

基准命令：

```text
cargo test --manifest-path src-tauri/Cargo.toml --test inventory_performance -- --ignored --nocapture
```

环境：Windows `10.0.26200.0`、Intel Core i5-13400F、63.8 GiB RAM、E 盘设备 `WUS721208BLE6L4`、Rust Debug 测试构建。数据集为 1,000 Skill / 100,000 文件。

| 指标 | 结果 |
|---|---:|
| 首次全量扫描 | 40,277 ms |
| 修改一个 Skill 后增量扫描 | 12,044 ms；`instances_changed=1` |
| 已有索引搜索 P95，100 次 | 3 ms |
| 单实例详情 P95，100 次 | < 1 ms |
| 完整基准含夹具创建/清理 | 109.29 s |

查询指标满足设计门槛。增量扫描只重解析/重哈希一个 Skill，但手动全根增量仍需遍历 100,000 个文件的 metadata；监听驱动的定向调度是后续性能优化点。

## 10. 已知限制

1. `notify` 监听 Adapter、去抖队列和状态契约已实现并测试，但桌面生命周期尚未自动启动/重启监听线程；当前可用入口仍是手动/调用方触发的增量扫描。
2. 自定义 `ignore_rules` 已持久化，扫描器本轮只应用内置忽略项；自定义 glob 解释器留给扫描设置联调。
3. Git 证据只在当前扫描根边界内向上查找 `.git`，读取 remote/commit；不运行 Git，因此不计算 worktree dirty、packed refs 或 submodule 状态。
4. 文件树索引保存文件路径而不单列目录节点；前端按相对路径重建目录树。
5. quick signature 依赖路径/类型/大小/mtime；外部工具若在保持大小和 mtime 完全不变的情况下改写内容，需要强制全量扫描发现。
6. 本模块不实现中央库纳管、发布、同步、AI Provider 或删除；MiniMax 仅有 0 分候选证据入口。

## 11. 中央库模块调用方式

中央库纳管应保持以下顺序：

1. 调用 `inventory_instance_get` 读取实例、文件树、`content_hash`、来源结论和 `missing_at`，拒绝缺失或解析路径不再有效的实例。
2. 在中央库 service 内将源目录只读复制到 staging，重新计算同一 `content_hash` 并校验与计划一致；inventory 不负责复制或修改外部源。
3. 创建中央 `skills` 记录、初始快照和来源记录后，在同一 SQLite 事务中调用 `inventory::repository::attach_central_skill(conn, instance_id, central_skill_id)`。
4. 写入应用安装记录时同时追加 `app_install_record` 来源证据，再调用 `origin::service::recalculate`；用户确认仍保持最高优先级。
5. 提交后通过实例 ID 失效前端查询。不要把完整实例放进事件，也不要用外部绝对路径作为写入/删除 command 参数。

中央库应把 inventory 的 `content_hash` 当作纳管计划的输入校验，而不是把扫描实例当作可写主副本。
