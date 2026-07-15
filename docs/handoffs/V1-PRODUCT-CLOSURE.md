# Skill Studio Pro Draft 0.2 V1 产品闭环交接

日期：2026-07-16
分支：`wave-0-baseline`
起始基线：`30a22bd0c08d90e6315e8c195c46ff46a6d81642`
产品闭环实现提交：`483c47588fe33d0c1243feddb848a317e51e8890`

## 结论

Task 1 已实现 Draft 0.2 Gate B 要求的编辑器、AI 简介/用法、平台中心和扫描根四个 V1 闭环。生产页面使用现有 Tauri IPC 与安全后端入口，测试使用注入依赖、临时目录和 Mock Provider，没有读写用户真实 Skill、Agent 目录、数据库或凭据管理器。

## 真实编辑器闭环

- 中央 Skill 详情中提供文件列表、只读/编辑切换，并支持 Markdown、YAML、JSON、TOML 和纯文本。二进制或不支持的文本格式不在应用内写入。
- 外部扫描实例保持只读，只能先执行现有纳管计划再编辑；纳管不移动原目录。
- 保存路径为 `lifecycleApi.saveTextFile` → `lifecycle_text_file_save`，输入仅包含稳定 `skillId`、`relativePath`、文本内容与每个 Skill 稳定的 `editSessionId`，前端没有任意绝对路径写入入口。
- 实现 dirty 状态、文件/详情标签/侧栏路由/返回切换确认、窗口关闭提示、放弃修改、保存中、JSON 客户端格式错误、YAML/TOML 后端权威校验与保存失败保留输入。
- 保存成功展示恢复点、before/after hash 和 `outdatedMappingCount`，并重新加载快照、工作区 diff、操作记录与映射状态。
- 外部编辑器只复用受控后端入口；应用重新获得焦点时重读当前相对路径，检测改变后刷新详情状态。

## AI 简介与用法闭环

- 无缓存时显示生成入口，已有产物可强制重生成，stale 产物显示过期重生成；页面覆盖 running、cancelled、success、error、cache 和 stale 状态。
- 生成使用 `aiApi.generateArtifact/cancelArtifact/listArtifacts` 的真实 IPC 契约。`extract_usage`、`suggest_tags` 和 `classify` 作为 MiniMax 采集任务，`final_summary` 作为 OpenAI 最终提炼任务；单项失败保留已成功结果。
- 每件产物展示后端返回的 Provider ID、实际模型 ID、职责、生成时间和“AI 可能出错”提示。
- 自动补充开关默认关闭。用户显式开启后，只枚举中央库已纳管 Skill，仅对缺失/过期项按需读取 `SKILL.md`，使用并发度 2 的有界队列，可暂停/继续。首次扫描不触发无条件上传。
- API Key 仅在输入与安全保存调用期间短暂存在；保存成功或失败都立即从普通 UI 状态清除。自动补充的 `localStorage` 只保存开关和暂停布尔值。

## 平台中心与扫描根

- `ProPlatformsPage` 已移除静态平台卡片，使用 `platform_detect`、`save_platform_connection`、`test_platform_path`、`platform_governance_impact`、`create_custom_platform` 和 `delete_custom_platform` 的真实数据与命令。
- 展示检测/启用状态、Skill 目录、copy/symlink 能力、受管 Skill 数、最近状态和平台局部错误。后端从映射与同步记录汇总这些字段。
- 修改目录、停用或删除尚有映射/项目影响的平台前会获取 governance impact 并显示确认。删除自定义平台仅删除配置和受管发布目标，不删除外部目录。
- 扫描根面板使用 `inventory_root_list`、`inventory_root_upsert` 和 `inventory_scan_start`，支持列表、添加、编辑、启停、watch 配置/可用性/最近扫描、选定根增量扫描与强制全量扫描。停用通过 `enabled=false` 实现，没有新增任意路径删除命令。
- Codex、Claude Code、Cursor、Windsurf 和 Gemini CLI 继续通过注入 Home 的 Rust 契约测试。Windows symlink 在执行时显式探测，不可用时返回失败，不会静默改为 copy。

## 真实与 Mock 边界

| 边界 | 生产 | 自动化验证 |
|---|---|---|
| 编辑保存 | 真实 `lifecycle_text_file_save`，后端执行路径安全、恢复点、hash 和 mapping outdated | 注入 API + Rust 临时目录，不读写用户目录 |
| AI | 真实 Tauri IPC，实际 Provider 仅在用户显式配置/触发后调用 | Mock MiniMax/OpenAI 或注入 `AiApi`，无外部 Provider 网络访问 |
| 平台/扫描根 | 真实平台和 inventory IPC | 注入 Home、临时目录、Mock IPC，无用户 Agent 目录写入 |
| 凭据 | 后端安全凭据存储或进程内临时存储 | 内存契约/Mock，无真实 Credential Manager 写入 |

## 测试结果

2026-07-16 在 Windows 工作区、提交 `483c47588fe33d0c1243feddb848a317e51e8890` 上执行：

- `npm run typecheck`：通过。
- `npm run test`：通过，60 个测试文件，287 个测试，0 失败，0 跳过。
- `npm run build`：通过，Vite 生产构建完成。
- `cargo fmt --check`：通过。
- `cargo clippy -- -D warnings`：通过；`npm run check` 中另以 `--all-targets` 通过。
- `cargo test`：通过，109 个非 ignored Rust 测试全部通过；发布候选 1,000 Skill/100,000 文件性能基准按既有约定为 ignored。
- `npm run check`：通过，包含 typecheck、test、build、Rust fmt/check/clippy/test 和 repository hygiene。
- `npm run security:repo`：通过；在 `npm run check` 内和交接文档生成后都已执行，最终检查 553 个受跟踪或未忽略候选文件。
- `git diff --check`：通过。

新增覆盖包含 E2E-009～011 的组件/跨层等价测试：五类文本与 dirty guard、保存后跨层刷新、AI 部分成功/取消/stale/force/有界队列、平台高风险治理确认、扫描根磁盘零删除、真实 command 名、camelCase 参数和返回字段契约。

## 已知限制与后续 Gate

- 本任务完成 Gate B，没有使用用户真实 Provider 凭据；因此不声称 MiniMax/OpenAI 真实连接已验收。
- Gate C 的 Windows 真实 WebView 桌面驱动/截图验收、Gate D 的发布候选性能基准和三平台 CI、Gate E 的开源发布产物不在 Task 1 范围内，仍需后续任务执行。
- 本任务没有创建 GitHub Release，也没有对真实用户目录或凭据存储做写入验收。
