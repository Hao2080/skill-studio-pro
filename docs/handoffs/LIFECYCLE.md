# Skill Lifecycle Handoff

## 状态

- 状态：`HANDOFF_READY`
- 日期：2026-07-16
- 分支：`wave-0-baseline`
- 实现提交：`085c689d3c3100cb7ed91aa71a1dbc1a751aae6e`
- 范围：Skill 导入、安装预览、中央库文本编辑、快照、删除计划、应用回收站、恢复、永久删除、操作记录和崩溃恢复。

## 导入来源

统一入口是 `SourceAdapter`，所有来源必须先复制、克隆或解压到应用管理的 staging，再执行发现、风险扫描、冲突计算和安装；不会直接从源位置写入中央库，也不会执行 Skill 自带脚本。

支持以下来源：

- 本地目录。
- GitHub/Git 仓库；支持仓库子目录、branch、ref/tag 和精确 commit。
- ZIP 压缩包。
- 上游市场来源；市场适配器接受上游解析后的本地目录、Git URL 或 ZIP 路径，并进入同一 staging 流水线。

Git 调用只通过 `Command` 参数数组执行，不经过 shell 拼接。持久化 URL 会去除凭据；来源参数会拒绝命令选项注入、控制字符和不安全协议。ZIP 导入拒绝 Zip Slip、绝对路径、Windows 路径前缀、符号链接/特殊文件、过量文件、单文件/总解压体积越界和异常压缩比。

## 安装计划接口

主要后端接口：

- `LifecycleService::create_import_plan(ImportPlanInput)`
- `LifecycleService::execute_import_plan(ImportPlanExecutionInput)`
- `SourceAdapter::stage(...)`

IPC：

- `import_plan_create`
- `import_plan_execute`

安装计划包含：

- `plan_id` 和 `plan_hash`
- 来源类型与脱敏后的来源信息
- Git resolved commit、ref、branch 和仓库子目录
- 发现的 Skill、文件数和文件树摘要
- 脚本清单、风险、冲突和可用冲突动作
- 目标 Agent
- `deferred_publish = true`

执行时会重新计算 staging 内容哈希并校验 plan ID/hash；预览后源内容或 staging 内容发生变化会返回 `PLAN_STALE`，清理 staging 并记录失败。冲突动作支持安装、改名、更新和取消。默认行为是先写入中央库，发布到 Agent 由后续显式操作完成。

旧的直接变更 IPC `skill_import`、`skill_delete` 和 `write_skill_file` 已被保护为计划式接口错误，避免绕过预览、回收站和事务语义。

## 编辑和快照行为

中央库文本编辑支持 Markdown、YAML、JSON、TOML 和纯文本。

- 写入前验证 `relative_path`：拒绝绝对路径、父级穿越、路径前缀、符号链接和越出 Skill 根目录的目标。
- 结构化文本在写入前解析验证。
- 文件先写入同目录临时文件并刷新，再原子替换目标文件；Windows 使用 `MoveFileExW` 的替换和 write-through 语义。
- 同一编辑会话首次保存前创建恢复点，后续保存不重复创建。
- 保存成功后，将该 Skill 的现有平台映射标记为 `outdated`。
- 继续复用中央库模块现有的文件树、内容哈希、快照、恢复和 diff 能力。

IPC：

- `lifecycle_text_file_save`
- `snapshot_create`
- `snapshot_restore`

前端 `skillsApi.writeSkillFile` 已迁移到新的安全保存接口，并为 Skill/路径生成稳定编辑会话 ID。

## 回收站状态机

```text
active
  -> delete planned
  -> mappings removed
  -> trash move journaled
  -> trashed
       -> restore planned -> active (原名或新名称，不自动重新发布)
       -> purge confirmed -> permanently deleted
```

删除计划会展示中央文件、文件数/大小、来源和所有映射影响。默认删除只移动到应用回收站。回收站条目保存 manifest、原路径、来源快照、映射快照和内容哈希。

恢复支持：

- 原名称无冲突恢复。
- 恢复为新名称。
- 默认不恢复 Agent 发布映射，只保留映射快照供用户判断。

永久删除规则：

- 只能处理数据库中状态为 `trashed` 的条目。
- `trash_purge_execute` 只接受 trash entry ID 和短期确认 Token。
- 实际文件路径由数据库条目解析并再次执行 allowed-root 校验，不接受调用方路径。
- 没有直接永久删除 Skill 的 IPC，也没有自动清空回收站任务。

IPC：

- `trash_plan_create`
- `trash_move_execute`
- `trash_list`
- `trash_restore_plan`
- `trash_restore_execute`
- `trash_purge_confirmation_create`
- `trash_purge_execute`

## 操作日志

`operation_logs` 记录导入预览/执行、安装成功/失败、编辑、快照、移入回收站、恢复、永久删除和崩溃恢复。日志包含 operation ID、类型、状态、实体、时间和结构化详情；错误详情写入前会脱敏。

查询接口：

- 后端：`LifecycleRepository::list_operation_logs`
- IPC：`operation_list`
- 前端：`src/features/activity/api/activityApi.ts`

生命周期和回收站变更会发送 `operation://updated` 事件，供活动记录 UI 刷新。

## 数据库迁移

Schema 版本提升到 4。`lifecycle_v4` 包含：

- 扩展 `skill_import_logs`：`source_commit`、`source_ref_name`、`source_subdir`、`plan_id`。
- 新增 `trash_entries`：回收站状态、原路径、trash 路径、manifest、内容哈希、确认 Token 哈希和有效期。
- 新增 `edit_recovery_points`：按编辑会话保存首次保存前恢复点。
- 新增 `staging_journals`：导入、编辑、移入回收站、恢复和永久删除的事务阶段。
- 新增相应索引和 migration 记录。

新库 schema 与升级迁移保持一致；AI v3 迁移仍只负责自身 schema，随后由 lifecycle v4 推进最终版本。

## IPC 和前端模型

新增后端 command 模块：

- `commands/lifecycle.rs`
- `commands/trash.rs`
- `commands/operations.rs`

新增前端 API/model：

- `src/features/lifecycle/api/lifecycleApi.ts`
- `src/features/lifecycle/model/index.ts`
- `src/features/trash/api/trashApi.ts`
- `src/features/trash/model/index.ts`
- `src/features/activity/api/activityApi.ts`
- `src/features/activity/model/index.ts`

## 故障恢复

staging journal 同时保存为文件和数据库记录。应用启动完成数据库初始化后执行恢复：

- 导入中断：删除允许根目录内的 staging，计划标记失败并写日志。
- 编辑中断：清理残留临时文件，保留原文件或原子替换后的完整文件。
- 移入回收站中断：根据数据库是否仍为 active 决定回滚文件移动或清理残留容器/manifest。
- 恢复中断：数据库未激活时将内容移回回收站。
- 永久删除中断：数据库条目仍存在时从 purge staging 恢复，否则清理 staging。

恢复流程同样执行 allowed-root 和符号链接检查。恢复错误会阻止应用继续启动，避免静默进入未知状态。

故障注入覆盖：来源 staged 后、数据库提交前、原子替换前、移入回收站后、恢复移动后和永久删除移动后。

## 测试结果

2026-07-16 在 Windows/PowerShell 本地验证：

- `cargo fmt --check`：通过。
- `cargo clippy --all-targets -- -D warnings`：通过。
- `cargo test`：通过；Rust 单元测试 53 个，集成测试覆盖 AI 9、DB 4、inventory 5、library mapping 11、lifecycle 10、store 2、team 5；performance 1 个测试保持 ignored。
- `npm run test`：通过；42 个测试文件，242 个测试通过，2 个跳过。jsdom 仅输出伪元素能力提示。
- `npm run typecheck`：通过。
- `npm run build`：通过。
- 本地目录、Git 分支/ref/commit/子目录、ZIP 和市场解析来源导入：通过。
- 文件事务故障注入、启动恢复、回收站路径越界防护：通过。
- 上游文件树、快照、diff 和 library mapping 回归：通过。

## 已知限制

- 市场适配器依赖上游市场模块先解析出本地目录、Git URL 或 ZIP 路径；本模块没有重新设计市场 UI 或市场解析器。
- Git 网络导入依赖系统 `git` 可执行文件。服务端若禁止直接 fetch 任意 commit，精确 commit 导入可能需要该 commit 能由配置的 ref 到达。
- ZIP 中的符号链接直接拒绝，不做保留或实体化。
- Windows 已完成本地验证；macOS/Linux 的运行时矩阵仍需 CI 覆盖。
- 删除多个已发布映射时采用现有 MappingService 逐个移除；中途失败会保留中央 Skill 并写失败日志，已移除的早期映射需要用户重新发布。
- 启动恢复遇到权限或外部文件占用导致的不可恢复错误时会停止启动，需要先修复文件权限/占用问题。
