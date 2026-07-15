# Skill Studio Pro 主干集成与前后端联调交接

状态：`HANDOFF_READY`
完成日期：2026-07-16
分支：`wave-0-baseline`
工作目录：`E:\AIHHao_Data\Codex_Xiangmu\Skills-All-in`

## 1. 提交与历史

- UI 分支：`wave-1-ui-shell`，合并前 HEAD `7b683fa0b0a0c16c19acdd0efb9ca1e707dbcd79`。
- 保留双方历史的 merge commit：`56dd7030f0052c02e7c8e84b8d7413f324764c2d`。
- 前后端联调实现 commit：`52868b375ee214a06f5c0038936d4d9eba05e734`（`feat: integrate pro UI with secure backend IPC`）。
- 本交接文档在实现提交后单独提交；文档提交以交付时 `git rev-parse HEAD` 为准。

合并使用 Git `ort` 的非快进 merge，没有文本冲突，也没有用整目录覆盖任一侧。语义合并按以下规则完成：

- 后端 command、service、稳定 UUID、计划哈希、路径边界、凭据和迁移契约沿用主分支。
- UI 路由、页面结构、深海蓝 Pro 视觉、设计 Token、品牌资产和两步高风险确认沿用 UI 分支。
- UI 分支的静态数据只保留为显式浏览器预览；Tauri 页面改为调用主干真实 IPC。

## 2. 真实接入矩阵

| UI 范围 | Tauri 真实接口 | 联调结果 |
|---|---|---|
| 总览 | `inventory_instance_list`、`inventory_root_list`、`library_skill_list`、`ai_provider_list`、`operation_list` | 真实汇总；分区失败时显示部分加载，不自动调用模型 |
| 本机 Skill 列表 | `inventory_root_list`、`inventory_instance_list`、`inventory_scan_start`、扫描进度事件 | 真实索引、扫描状态、风险、重复和来源可信度；列表返回来源结论映射，避免 N+1 IPC |
| 本机 Skill 详情 | `inventory_instance_get`、`inventory_instance_file_read`、`origin_resolution_recalculate`、`library_instance_register_plan/execute` | 真实元数据、文件树、来源证据、只读 `SKILL.md`、纳管计划；原实例不移动 |
| 中央库列表 | `library_skill_list`、`library_skill_drift_check` | 稳定 UUID 主副本、映射数量、漂移和未发布状态；映射失败按部分加载显示 |
| 中央库详情 | `library_skill_get`、`library_skill_drift_check`、快照/文件/操作/AI 缓存查询、`library_skill_publish_plan/execute` | 真实主副本、映射、快照、缓存模型归属和两阶段发布；默认 copy、漂移默认 abort |
| 模型与 API | `ai_provider_list/save/test`、`ai_task_route_list/save` | MiniMax/OpenAI 配置、实际模型 ID、职责和连接测试；Key 保存后或失败后立即清空输入，只显示安全尾号 |
| 发现与安装 | `import_plan_create/execute` | 本地目录、Git、ZIP 都进入真实 staging/预览；冲突必须选动作；发布保持 deferred |
| 回收站 | `trash_list`、`trash_restore_plan/execute`、`trash_purge_confirmation_create/execute` | 真实恢复、冲突改名计划；永久删除要求影响确认、精确名称和后端短期 Token |
| 操作记录 | `operation_list`、`operation://updated` | 真实审计记录、筛选、加载/空/错误状态和事件刷新 |

所有真实 API Key 只会在用户输入到保存完成之间短暂存在于受控输入状态；不写 localStorage、普通设置、日志或 Mock。连接测试只在用户明确点击时触发。本次联调和测试没有调用真实 MiniMax/OpenAI。

## 3. 最小后端契约补齐

新增 `inventory_instance_file_read(instanceId, relativePath)`：

- 调用方只传稳定实例 ID 和普通相对路径，不传绝对路径。
- 后端从数据库解析实例根，拒绝缺失实例、绝对路径、父级穿越、符号链接和越界路径。
- 只读取普通 UTF-8 文本，预览上限 2 MiB；不会执行脚本。

`inventory_instance_list` 增加按实例 ID 索引的 `resolutions` 字段。该字段是向后兼容的附加返回值，使列表和总览可在一次 IPC 中显示确定性来源结论；前端对旧 Mock/旧返回仍保留详情回退。

## 4. Tauri、bootstrap、迁移与序列化审计

- `commands::command_handlers!` 已包含 inventory、origin、library、lifecycle、trash、operation、AI 及新只读文件命令；新增注册守卫测试。
- 启动顺序保持 `workspace::prepare -> db::init_db -> lifecycle staging recovery`。command 不依赖缺失的 Tauri managed state；service 以应用工作区为唯一 bootstrap 来源，每次按需获取受配置的 SQLite 连接。
- 迁移顺序确认并增加守卫：`inventory_index_v1 -> library_mapping_v2 -> ai_routing_v3 -> lifecycle_v4`。全新库记录 1–4；高于当前版本的 `user_version` 不会被降低。
- Rust IPC DTO 使用 `#[serde(rename_all = "camelCase")]`，枚举值按既有 `snake_case`；TypeScript 请求保持 `{ input }` 包装、camelCase 字段和后端返回类型一致。
- 永久删除仍只接受 `trashEntryId + confirmationToken`；发布仍只接受 Skill/快照/平台/策略，不接受任意目标路径。

## 5. 测试结果

Windows 本地最终结果：

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | 通过 |
| `npm run test` | 50 files；261 passed，2 skipped，0 failed |
| `npm run build` | 通过；Vite 6.4.3，2303 modules transformed |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check` | 通过 |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | 通过 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 55 unit + 46 integration passed；1 performance ignored；0 failed |
| `npm run check` | 通过，聚合执行全部上述检查 |
| `git diff --check` | 通过 |

新增或更新的测试覆盖：

- 前端到 IPC 的命令名、`{ input }` 包装、camelCase 参数、plan ID/hash 和 ID 型删除请求。
- UI 加载、空、完整错误、来源详情部分失败和导入 `partial_success`。
- 永久删除的影响确认、精确名称、确认前不请求 Token，以及后端 Token 执行形状。
- API Key 保存后从 UI 状态清除。
- 实例原文读取的稳定 ID、正常读取和 `../` 越界拒绝。
- command 注册集合与 v1–v4 单调迁移。

测试只使用临时目录、Mock Provider 和虚构凭据；没有执行 Skill 脚本，没有读取或修改用户真实 Agent Skill。

## 6. 秘密与产物审计

- 本机未安装 `gitleaks`，因此没有伪造 Gitleaks 成功结果。
- 对 `src`、Rust 源码/测试、文档、README、NOTICE 和 CI 使用高置信 Token、云凭据和私钥模式扫描；未发现真实秘密。
- 宽松 Bearer 扫描只命中既有 `fictional`/`example` 脱敏测试夹具。
- tracked/untracked 审计未发现数据库、WAL/SHM、日志、回收站内容、staging、用户配置或本机 Skill 数据。
- `dist/`、`target/` 和测试临时数据保持忽略，没有进入提交。

## 7. 仍保留的 Mock 与未接线入口

- 显式浏览器预览 `?preview=pro` 使用 `browserPreviewProCommands.ts` 的类型化内存 Mock；Tauri runtime 不走该分支。
- 原 UI 分支的 `mockInstallApi.ts`、`mockTrashApi.ts`、`mockAiSettingsApi.ts` 仍作为测试/历史预览夹具保留，但生产页面已不再导入它们。
- `ProPlatformsPage` 仍是静态展示；本次要求的中央库映射与发布状态已在中央库列表/详情接入真实接口，平台中心的配置编辑可在下一阶段切换到既有 `platformsApi`。
- “新建 Skill”、扫描根管理、操作记录导出、市场来源选择和全局搜索仍是展示或禁用入口；本地/Git/ZIP 导入已真实可用。
- 未执行真实 WebView 三平台像素验收、打包 smoke、macOS/Linux native Secret Store 或 symlink 运行时矩阵。

## 8. 下一阶段测试建议

1. 在 WebView2、WKWebView、WebKitGTK 上跑首次扫描、详情原文、纳管、导入、发布、回收和 Provider 配置 E2E。
2. 为平台中心替换静态卡片，并验证五个首要 Agent 的启用、目录配置、copy 默认和 symlink 明确降级。
3. 用本地 Mock Git/HTTP 服务覆盖 Git branch/ref/commit/subdir、网络中断和 `PLAN_STALE` 的桌面 E2E。
4. 覆盖恢复原路径冲突、恢复为新名称、映射删除部分成功和发布漂移阻断的视觉流程。
5. 在隔离 CI 用户上验证 Windows Credential Manager、macOS Keychain、Linux Secret Service 不可用契约。
6. 发布候选安装包继续执行 Gitleaks 全历史扫描、产物内容扫描和三平台安装/启动 smoke。
