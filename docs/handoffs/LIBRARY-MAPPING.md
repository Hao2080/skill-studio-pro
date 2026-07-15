# Skill Studio Pro Library & Mapping 交接

状态：`HANDOFF_READY`  
完成日期：2026-07-15  
工作目录：`E:\AIHHao_Data\Codex_Xiangmu\Skills-All-in`

## 1. 分支和 commit

- 分支：`wave-0-baseline`
- 中央库/映射实现 commit：`b3f26bb`（`feat: add central library and agent publishing`）
- 本交接文件单独提交，避免用不稳定的自引用 hash；实现范围以 `b3f26bb` 为准。
- 本次没有实现 Git/ZIP 安装、回收站、AI 或 UI 视觉；共享工作树中的 AI 改动由对应模块维护者负责，不纳入本模块实现提交。

## 2. 中央库身份和目录方案

- `skills.id` 是中央 Skill 的稳定 UUID；纳管始终生成 UUID v4，所有实例关联、快照、映射、日志和锁均引用该 ID。
- 新增不可变 `skills.storage_rel_path`。新建和纳管目录为 `skills/<skill-id>/<slug>/`；既有上游记录以 `COALESCE(storage_rel_path, slug)` 继续读取旧 `skills/<slug>/`。
- slug 仅用于显示和首次发布目录名。修改 slug 不改变 UUID、中央存储目录或已存在映射的 `target_path`。
- 上游文件树、读写、外部编辑、快照、恢复和 diff 已统一通过稳定存储路径解析；快照目录使用 Skill ID，快照记录仍保存绝对 `snapshot_path`。
- `skills` 同时扩展 `canonical_name`、`active_content_hash`、`lifecycle_state` 和 `trashed_at`，供后续生命周期模块复用。

## 3. 纳管流程

1. `library_instance_register_plan` 按实例 ID 读取 inventory 详情，拒绝 missing 或已纳管实例。
2. 验证来源是绝对普通目录且根内存在 `SKILL.md`；不接受来源根符号链接/junction。
3. 使用 inventory 同一目录哈希规则锁定源内容，检查名称/slug 冲突，生成中央 UUID、目标和五分钟有效的 plan hash。
4. execute 获取 Skill ID 锁与目标路径锁；再次计算来源哈希，变化时返回 `PLAN_STALE`。
5. 只读复制到 `staging/library/<plan-id>`；默认排除 `.git`、`node_modules` 和 `target`。相对符号链接只有解析后仍在来源根内才复制，绝对或逃逸链接被拒绝。
6. 校验 staging 哈希后同卷原子移动到 `skills/<uuid>/<slug>`，并复制出 `snapshots/<uuid>/v1` 初始快照。
7. 同一 SQLite 事务创建 `skills`、`skill_sources`、初始 `skill_snapshots`、实例关联、`app_install_record` 来源证据和 `operation_logs`；失败会移除本次应用拥有的中央目录和快照，原实例始终不移动、不修改。
8. 提交后重算来源结论；inventory 自动证据刷新会保留 `app_install_record` 和人工确认。

## 4. PlatformAdapter 接口和注册表

`src-tauri/src/platform/` 提供对象安全的 `PlatformAdapter`：

- `id`、`display_name`
- `detect`、`default_global_skills_dir`
- `validate_target(configured_root, target)`
- `supports_copy`、`supports_symlink`、`symlink_capability`
- `normalize_target_name`
- `is_dedicated`

`PlatformRegistry::from_upstream` 直接投影上游 40+ 平台定义，避免复制平台路径常量。Codex、Claude Code、Cursor、Windsurf、Gemini CLI 标记为首要 dedicated Adapter；其余保留通用目录 Adapter。数据库中的 custom platform 会按其配置路径和能力动态注册为通用 Adapter。

首要全局目录：

| Adapter | 相对 Home 目录 |
|---|---|
| Codex | `.codex/skills` |
| Claude Code | `.claude/skills` |
| Cursor | `.cursor/skills` |
| Windsurf | `.codeium/windsurf/skills` |
| Gemini CLI | `.gemini/skills` |

## 5. 发布、同步和漂移状态

- 默认同步模式是 `copy`。`symlink` 必须同时通过 Adapter 能力和操作系统实际创建；Windows 返回 `requires_privilege_probe`，失败明确返回 `SYMLINK_UNAVAILABLE`，绝不静默降级成复制。
- `library_skill_publish_plan` 只接受 Skill、快照、平台名、同步模式和漂移策略，不接受任意目标路径。目标只能由已启用、已检测并注册 Adapter 的 `platform_connections.skills_dir` 派生。
- 发布计划保存 source hash、逐目标绝对路径、同步模式、observed hash、published hash、漂移状态、阻断原因、plan hash 和过期时间。
- copy 发布在目标 Agent 根创建应用专属同卷 staging；现有受管目标先原子改名为同卷 backup，再原子替换。哈希/标记/数据库任一步失败都恢复 backup。
- copy 所有权标记位于目标目录内 `.skill-studio-pro-managed.json`；symlink 标记位于目标旁。标记包含 Skill ID、平台和随机 ownership token。缺失或不匹配时拒绝覆盖和删除。
- `in_sync`、`drifted`、`missing`、`unknown`、`ownership_mismatch` 写入 release target。漂移默认 `abort`；只有重新预览并明确选择 `overwrite` 才允许替换受管漂移目标。非受管目标始终禁止覆盖。
- 多目标逐个提交，允许 `partial_success`，每个目标独立返回 hash 或错误码并写 `sync_logs`。
- `library_skill_remove_mapping` 只接受 Skill ID + platform name，从数据库解析目标，验证 Adapter 根和所有权后移除单个映射；中央主副本、来源和快照不变。
- 上游无计划哈希的旧 publish/sync/remove mutator IPC 现在返回 `SAFE_*_PLAN_REQUIRED`，防止绕过漂移预览。快照、diff 和发布状态查询继续可用。

## 6. 数据库迁移

本模块迁移是 `library_mapping_v2`：

- `skills`：`storage_rel_path`、`canonical_name`、`active_content_hash`、`lifecycle_state`、`trashed_at`
- `platform_release_targets`：`target_path`、`sync_mode`、`published_content_hash`、`observed_target_hash`、`drift_status`、`last_checked_at`、`ownership_token`
- `sync_logs`：`target_path`、`sync_mode`、`before_hash`、`after_hash`、`plan_id`、`detail_message`
- 新表：`library_operation_plans`、`operation_locks`、`operation_logs`
- 新索引：计划状态/过期、锁过期、操作实体/时间

迁移分级设置 `user_version`：inventory v1 只推进到 1，library v2 只推进到 2，后续模块再推进自己的版本，避免较早迁移提前宣称较高 schema 已完成。全新库和已有上游库均通过同一幂等迁移入口。

## 7. IPC 和前端契约

新增 IPC：

```text
library_skill_list
library_skill_get
library_instance_register_plan
library_instance_register_execute
library_skill_publish_plan
library_skill_publish_execute
library_skill_remove_mapping
library_skill_drift_check
```

前端模型和可注入 API：

- `src/features/library/model/libraryTypes.ts`
- `src/features/library/api/libraryApi.ts`
- `src/features/platforms/api/platformsApi.ts` 的安全发布预览、执行、移除和漂移检查入口
- `src/types/skill.ts` 的扩展发布目标/同步日志字段

前端 IPC Mock 契约验证纳管执行必须携带 plan hash、发布请求不含任意目标路径、移除映射只传稳定 ID。

## 8. 五平台与故障测试结果

本地环境：Windows，Rust/Cargo 1.96，Node 24。`npm run check` 完整退出码为 0；Vitest 为 39 个测试文件、237 passed、2 skipped；中央库/Adapter Rust 集成测试为 11 passed、0 failed。

| 测试 | 结果 |
|---|---|
| 五首要 Adapter 默认目录、检测、目标名、路径边界、能力声明 | 通过 |
| Codex/Claude/Cursor/Windsurf/Gemini 各自 copy 发布→漂移→显式覆盖→移除 | 通过 |
| copy 默认模式与多目标部分成功 | 通过 |
| symlink 成功或明确权限失败且不降级 | 通过 |
| slug 修改后中央目录和既有映射身份保持 | 通过 |
| 非受管冲突/所有权标记缺失禁止覆盖或删除 | 通过 |
| 操作锁、plan hash、计划过期、预览后目标变化 | 通过 |
| AfterStaging/AfterBackup/AfterReplace/BeforeDatabaseCommit 故障注入 | 通过，原目标保持或恢复 |
| 数据库迁移和扩展字段 | 通过 |
| 上游快照、diff、inventory、store、team 回归 | 通过 |

同一契约测试不含平台特定路径分隔符假设，可直接在 Windows/macOS/Linux CI matrix 运行；本地只实际执行了 Windows，macOS/Linux runner 结果仍需首次远端 CI 验证。

## 9. 已知跨平台限制

1. Windows symlink 取决于开发者模式、权限和文件系统；计划只声明需要 probe，执行创建失败会明确返回，不自动复制。
2. Windows junction/reparse root 通过 `symlink_metadata + canonicalize` 双重边界检查；真实企业策略、网络盘和特殊文件系统仍需 CI/人工矩阵补充。
3. 单目标 staging/backup/replace 位于 Agent 根以保证同卷原子 rename；若目标文件系统本身不支持原子目录 rename，会失败并恢复，不会改用非原子覆盖。
4. 本次实现进程/数据库操作锁和失败恢复，但没有实现启动时扫描 filesystem journal 的崩溃恢复器；异常断电可能留下应用命名的 staging/backup，后续生命周期模块应按 ownership token 接管清理/恢复。
5. 通用 Adapter 继承上游目录定义和能力；除五个首要 Agent 外尚未逐个平台验证特殊命名或项目级语义。
6. 本地只执行 Windows；macOS/Linux 的真实 symlink、权限和大小写文件系统结果待远端 matrix。

## 10. 生命周期模块依赖方式

- 生命周期模块必须以 `skill_id` 查询 `storage_rel_path`，不得从当前 slug 重新推导中央路径。
- 编辑、发布、回收、恢复共同使用 `operation_locks` 的 `skill:<uuid>` 和规范化 `path:<absolute>` 资源键；过期锁可回收。
- 回收中央 Skill 前先调用安全 mapping service 逐目标移除或保留明确失败状态；不得直接删除 `platform_release_targets` 后递归删除 Agent 目录。
- 删除/恢复计划应复用 `library_operation_plans` 的 plan hash/过期语义和 `operation_logs`，并只处理数据库解析出的应用目录。
- copy 目标所有权以目录内 marker + 数据库 ownership token 双重确认；symlink 目标还需确认链接本身，绝不能递归删除链接目的地。
- 生命周期快照继续使用现有 `skill_snapshots`；发布目标外键和删除前引用检查保护已发布快照。
