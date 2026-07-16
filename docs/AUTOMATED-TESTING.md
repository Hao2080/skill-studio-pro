# Skill Studio Pro 自动化测试方案

文档状态：Draft 0.2（V1 产品闭环修订）
日期：2026-07-16
依赖文档：[SPEC.md](./SPEC.md)、[PRD.md](./PRD.md)、[TECHNICAL-DESIGN.md](./TECHNICAL-DESIGN.md)

## 1. 测试目标

自动化测试必须证明 Skill Studio Pro 能在不破坏用户现有文件的前提下，正确发现、解释和管理 Skill，并在 Windows、macOS、Linux 上对安装、编辑、映射、回收和 AI 配置提供一致且可恢复的行为。

测试优先保护以下高风险边界：

1. 首次扫描零写入。
2. 同名实例不被错误合并或覆盖。
3. 中央库发布失败可恢复。
4. 删除默认进入回收站，永久删除不能越界。
5. 外部 Skill 脚本从不因扫描、导入或摘要被执行。
6. API Key 不进入数据库、日志、错误和 Git。
7. AI 不可用时本地核心功能正常。
8. 上游快照、diff、导入和平台能力不发生回归。

## 2. 测试原则

1. 每个 SPEC 编号至少映射一个自动化测试或明确的人工验收项。
2. 文件系统测试使用临时目录，不读取或修改开发者真实 Agent 目录。
3. AI 测试默认使用本地 Mock Server，CI 不调用真实 MiniMax/OpenAI，不消耗额度。
4. 路径安全测试包含恶意输入、符号链接、junction、权限和跨卷场景。
5. 测试失败不得通过降低产品安全语义来“修复”。
6. 单元测试快速、确定；平台和打包测试允许较慢但必须隔离。
7. 时间、UUID、主目录、网络和 Secret Store 必须可注入或替换。

## 3. 测试金字塔

| 层级 | 目标 | 运行频率 |
|---|---|---|
| Rust 单元测试 | 解析、哈希、路径、可信度、计划、脱敏等纯逻辑 | 每次提交 |
| TypeScript 单元/组件测试 | 页面状态、筛选、表单、模型归属和风险提示 | 每次提交 |
| 数据库与 Service 集成测试 | 迁移、事务、扫描、导入、映射、回收站 | 每次 PR |
| Adapter 契约测试 | Agent 路径、AI Provider、Secret Store | 每次 PR；平台矩阵 |
| Tauri IPC 测试 | command 参数、错误和事件契约 | 每次 PR |
| 桌面 E2E | 关键用户流程 | 主分支、发布候选 |
| 性能/安全/打包 | 发布质量门槛 | 每夜或发布候选 |

建议数量结构约为 60% 单元、25% 集成与契约、10% UI/E2E、5% 性能和安全专项。该比例不是覆盖率目标。

## 4. 测试工程基础

### 4.1 Rust 测试可执行性

上游 `Cargo.toml` 当前将 library `test = false`。进入开发阶段时必须调整测试配置，使业务模块内的 `#[cfg(test)]` 单元测试可运行，同时保留现有 `src-tauri/tests` 集成测试。

### 4.2 建议命令

```text
npm run typecheck
npm run test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
npm run test:e2e
npm run check
```

最终 `npm run check` 应聚合类型检查、前端测试、构建、Rust 格式、Clippy 和 Rust 测试；桌面 E2E 和打包矩阵可在独立 CI Job 运行。

### 4.3 可注入依赖

以下依赖必须通过 trait、接口或测试上下文替换：

- Home/App Data 路径
- 当前时间
- UUID 生成器
- 文件监听器
- Git 执行器
- HTTP Client
- MiniMax/OpenAI Provider
- Secret Store
- 系统外部编辑器
- 平台能力检测

## 5. 测试夹具

### 5.1 基础 Skill

```text
fixtures/skills/
  valid-basic/
  valid-with-bom/
  valid-crlf/
  no-frontmatter/
  invalid-yaml/
  chinese-content/
  scripts-and-assets/
  nested-skill/
  large-skill/
  symlink-loop/
  secret-containing/
```

每个夹具附 `expected.json`，描述名称、解析状态、文件数量、哈希、风险标记和预期来源证据。

### 5.2 多平台主目录

```text
fixtures/homes/
  standard/
    .codex/skills/
    .claude/skills/
    .cursor/skills/
    .codeium/windsurf/skills/
    .gemini/skills/
  duplicates/
  plugin-cache/
  permission-errors/
```

### 5.3 来源夹具

- 带 Git remote 与固定 commit
- 插件 manifest 精确声明 Skill
- 官方系统目录特征
- 应用安装记录匹配
- 内容内来源 URL
- 多候选冲突
- 完全未知
- 用户确认覆盖

### 5.4 安装包夹具

- 单 Skill Git 仓库
- 多 Skill Git 仓库
- 指定子目录
- ZIP 正常包
- Zip Slip 路径
- 超大文件/超多文件
- 绝对路径和符号链接
- 名称冲突和更新包

### 5.5 AI 响应夹具

- MiniMax 合法结构化采集结果
- GPT-5.6 合法摘要结果
- JSON Schema 不合法后修复成功
- 两次均不合法
- 401、403、404、408、429、5xx
- 流式中断
- 配额不足
- 模型不存在
- 响应包含敏感内容

所有夹具使用虚构凭据和仓库。

## 6. Rust 单元测试

### 6.1 扫描与解析

| 测试 ID | 场景 | 预期 |
|---|---|---|
| UT-INV-001 | 目录含 `SKILL.md` | 创建一个候选 |
| UT-INV-002 | 嵌套 `.system` Skill | 每个有效根独立发现 |
| UT-INV-003 | UTF-8 BOM | 正确解析 Front Matter |
| UT-INV-004 | 无效 YAML | 实例保留，状态为 error |
| UT-INV-005 | 普通目录无 `SKILL.md` | 不登记 Skill |
| UT-INV-006 | 符号链接循环 | 不死循环，不越界 |
| UT-INV-007 | 单目录权限错误 | 记录警告，继续扫描 |
| UT-INV-008 | 大文件分块哈希 | 哈希正确，内存受控 |
| UT-INV-009 | 嵌套两个 `SKILL.md` | 两个 Skill 根按规则登记 |
| UT-INV-010 | 扫描取消 | 有序停止并记录 cancelled |

### 6.2 哈希与重复

- 相同内容不同绝对路径产生相同 `content_hash`。
- 路径排序不受文件系统枚举顺序影响。
- CRLF 与 LF 是否视为不同必须与设计选择一致；原始哈希应不同。
- 忽略文件变化不影响 Skill 哈希。
- 同名同内容、同名不同内容、同内容不同名形成正确分组。
- 中央发布哈希与目标观测哈希不同时标记漂移。

### 6.3 来源可信度

| 测试 ID | 证据组合 | 预期 |
|---|---|---|
| UT-SRC-001 | 无证据 | 0、unknown |
| UT-SRC-002 | 已知平台路径 | 15、低可信度 |
| UT-SRC-003 | Git 精确 + 平台路径 | 50、低可信度 |
| UT-SRC-004 | 应用安装记录 + Git 精确 | 85、高可信度 |
| UT-SRC-005 | 插件 manifest + 系统路径 + 平台路径 | 80、中可信度 |
| UT-SRC-006 | 自动证据超过 100 | 截断为 99 |
| UT-SRC-007 | 用户确认 | 100、confirmed |
| UT-SRC-008 | 两项强冲突 | 正确扣分并显示冲突 |
| UT-SRC-009 | 证据算法版本变化 | evidence hash 变化并需重算 |
| UT-SRC-010 | MiniMax 候选未验证 | 不能成为高可信度结论 |

### 6.4 路径安全

- `../`、绝对路径、UNC、不同盘符、大小写变体。
- 符号链接和 Windows junction 指向允许根外。
- 目标目录在检查后被替换的 TOCTOU 场景。
- 递归删除只接受数据库解析的回收站路径。
- 还原目标冲突时不得覆盖。
- ZIP 中的 Zip Slip 和设备文件被拒绝。

### 6.5 文件事务

- staging 校验失败不触碰目标。
- 备份后替换失败能恢复原目标。
- 数据库提交失败能恢复文件状态。
- journal 在每个阶段崩溃后可正确恢复。
- 多目标发布一个失败不回滚已成功的其他目标，但报告部分成功。
- 同一 Skill 两个写操作被串行化。

### 6.6 AI 规则与脱敏

- 任务类型路由到正确 Provider 和模型。
- 配置改变使缓存失效。
- 输入哈希不变时命中缓存。
- API Key、Bearer Header、PEM、常见 Token 被移除。
- 高风险秘密命中时阻止发送。
- 日志错误不包含请求正文中的秘密。
- 结构化输出验证和一次修复逻辑正确。

## 7. TypeScript 单元与组件测试

### 7.1 列表与筛选

- 按名称、平台、来源、可信度、风险和纳管状态筛选。
- 组合筛选结果正确。
- 1,000 项列表使用分页或虚拟化且选择状态稳定。
- 扫描更新后仅刷新受影响项。

### 7.2 Skill 详情

- 本地说明、AI 说明和原文入口区分清楚。
- 两次点击内进入 `SKILL.md` 原文。
- 多路径实例全部展示。
- 来源状态、百分比和依据同时展示。
- 可信度不被标记为安全评分。
- 摘要过期状态可见。

### 7.3 ModelAttribution

- 显示 Provider、实际模型 ID、职责、时间和状态。
- MiniMax 与 OpenAI 使用统一布局。
- 缺少用量数据时不显示错误的 0 Token。
- 过期、失败和已禁用状态具有文本标记，不只靠颜色。

### 7.4 高风险确认

- 安装预览未完成时执行按钮不可用。
- 漂移未选择策略时禁止覆盖。
- 删除对话框默认选中回收站，不提供快捷永久删除。
- 永久删除必须在回收站并完成二次确认。
- API Key 输入默认掩码，复制和显示操作有明确交互。

### 7.5 可访问性

- 主要页面键盘导航顺序。
- 对话框焦点陷阱和关闭后焦点恢复。
- `aria-label`、状态文本和错误关联。
- 减少动态效果和降低透明度模式。
- 关键颜色对比度自动检查。

## 8. 数据库测试

### 8.1 全新数据库

- 所有表、索引、外键和默认值正确创建。
- schema version 与代码一致。
- WAL、busy timeout 和外键设置符合设计。

### 8.2 上游升级

以真实上游旧 schema 夹具执行迁移：

- `skills` 正确补充新字段。
- `skill_sources` 原记录保留并转为证据。
- `platform_release_targets` 保留发布关系。
- 项目和团队表不丢失，虽然第一代 UI 隐藏团队。
- 迁移失败时原数据库备份可恢复。

### 8.3 事务一致性

- Skill、实例、来源、快照和操作记录要么一起提交，要么一起回滚。
- 回收站文件移动成功但 DB 失败时可恢复。
- DB 成功但发布目标失败时状态反映部分失败。
- 外键约束阻止孤立记录。

### 8.4 并发

- 扫描批量写入与 UI 查询并发。
- 两个扫描任务不能同时接管同一根。
- busy timeout 后返回可重试错误，不损坏数据库。

## 9. Platform Adapter 契约测试

每个首要 Agent 运行同一套契约：

1. 从注入的 Home 解析默认全局目录。
2. 检测目录存在和不存在。
3. 扫描标准 Skill。
4. 复制发布。
5. 检测漂移。
6. 更新发布。
7. 移除映射但保留中央 Skill。
8. 符号链接能力声明和降级。
9. 目标名称规范化。
10. 项目级目录若支持则验证。

### 9.1 首要矩阵

| Adapter | Windows | macOS | Linux |
|---|---:|---:|---:|
| Codex | 必须 | 必须 | 必须 |
| Claude Code | 必须 | 必须 | 必须 |
| Cursor | 必须 | 必须 | 必须 |
| Windsurf | 必须 | 必须 | 必须 |
| Gemini CLI | 必须 | 必须 | 必须 |

其余上游平台至少运行通用定义测试：名称唯一、路径合法、能力字段完整、自定义覆盖有效。

## 10. 导入与生命周期集成测试

### 10.1 本地目录

- 预览不修改来源。
- 执行后中央库内容匹配。
- 来源记录和初始快照存在。
- 名称冲突三种策略正确。

### 10.2 Git

- remote、ref、commit 和子目录被记录。
- Git 命令使用参数数组；恶意 URL 不产生 shell 注入。
- 网络中断后 staging 清理。
- plan 创建后仓库内容变化导致 `PLAN_STALE`。

### 10.3 ZIP

- 合法单 Skill 和多 Skill 包。
- Zip Slip、绝对路径和越界链接拒绝。
- 文件数、大小和解压总量限制。
- 错误包不写入中央库。

### 10.4 编辑

- 首次保存创建恢复点。
- 原子写入失败保留旧文件。
- 相对路径越界被拒绝。
- 保存后映射变为 outdated。
- 外部编辑触发漂移/变更状态。

### 10.5 回收站

- 删除中央 Skill 移动到回收站并保留 manifest。
- 删除前映射影响范围准确。
- 恢复无冲突回原位。
- 冲突时不覆盖并提供新名称计划。
- 永久删除不接受任意路径。
- 各事务阶段故障后可恢复。

## 11. AI Provider 契约测试

MiniMax 和 OpenAI Provider 运行统一契约：

- 从 Secret Store 获取凭据。
- 构建正确鉴权，不把密钥写入日志。
- 连接测试成功。
- 鉴权失败、网络失败、限流、配额、模型不存在分类正确。
- 超时和取消有效。
- 重试只针对允许重试的错误。
- 用量和实际模型 ID 正确返回。
- Mock 流式响应和非流式响应均可解析。

### 11.1 任务职责测试

- `extract_usage` 默认调用 MiniMax。
- `final_summary` 默认调用 `gpt-5.6`。
- UI 记录实际返回模型，而不是只用配置显示名。
- MiniMax 不可用时，最终提炼可使用本地解析输入降级。
- OpenAI 不可用时，不把 MiniMax 草稿冒充为 GPT-5.6 最终摘要。
- Provider 全部关闭时，本地扫描与管理不受影响。

### 11.2 禁止真实计费

CI 设置网络拦截或注入 Mock base URL。若测试尝试访问 MiniMax/OpenAI 真实域名，测试必须立即失败。

## 12. Secret Store 测试

### 12.1 单元与 Mock

- set/get/delete 契约。
- 普通配置只保存 `secret_ref` 和脱敏尾号。
- Secret Store 异常不退回明文。
- 进程内临时 Key 在退出后不可恢复。

### 12.2 平台集成

在隔离的 CI 用户和测试服务名下验证：

- Windows Credential Manager
- macOS Keychain
- Linux Secret Service；若 Runner 无 session bus，执行明确的 unavailable 契约而非跳过安全逻辑

测试结束只删除自己的测试凭据。

## 13. Tauri IPC 测试

- command 参数缺失和无效枚举。
- 任意路径不能穿过 ID 型接口进入删除操作。
- `AppError` code、message、retryable 和 userAction 完整。
- details 已脱敏。
- 扫描进度事件单调且最终有 completed/cancelled。
- 大列表通过查询命令获取，不在事件中广播完整对象。
- 前端浏览器 Mock 与真实 command 类型保持一致。

建议生成或共享 TypeScript/Rust 契约定义，CI 检查字段漂移。

## 14. 桌面端 E2E 测试

### E2E-001 首次启动离线盘点

注入测试 Home，启动应用，不配置 API；完成扫描、列表展示、详情打开和原文查看，验证测试目录哈希未变化。

### E2E-002 纳管并发布

扫描 Claude Skill，纳入中央库，发布到 Codex 和 Cursor，确认中央主副本、两个映射和操作记录。

### E2E-003 Git 安装

从本地 Mock Git Server 安装指定 commit，预览后进入中央库并发布到 Gemini CLI。

### E2E-004 编辑、漂移与冲突

编辑中央 Skill 并发布；外部修改目标后再次发布，应用必须显示漂移并阻止静默覆盖。

### E2E-005 删除与恢复

删除中央 Skill，确认进入回收站；恢复后中央内容和快照关系正确，其他无关目录未变化。

### E2E-006 模型配置与摘要

配置 Mock MiniMax/OpenAI，测试连接，生成采集结果和最终摘要，确认模型名称、职责和时间均显示。

### E2E-007 Provider 故障降级

Mock 返回 429/500，应用显示错误；用户仍能查看、编辑和同步 Skill。

### E2E-008 窗口和可访问性

在 900×600、1280×800 和高 DPI 配置验证关键流程、键盘导航、减少动态效果和透明度降级。

### E2E-009 真实编辑器闭环

在中央 Skill 中打开 Markdown、YAML、JSON、TOML 和纯文本，验证只读/编辑切换、dirty guard、格式错误、保存、恢复点、diff 和 mapping outdated。保存失败必须保留编辑内容；外部实例必须先纳管。

### E2E-010 AI 简介与用法闭环

使用 Mock MiniMax/OpenAI 在详情页触发生成，验证进度、取消、成功、分类错误、缓存、stale、force 重新生成和 ModelAttribution。默认不得自动上传全部 Skill；开启自动补充后验证有界队列、暂停和最小输入。

### E2E-011 平台与扫描根闭环

使用注入 Home 验证五个首要 Agent 的真实检测、路径测试、目录保存、启停、copy 默认、symlink 能力提示、治理影响、自定义扫描根和选定根扫描。移除根配置不得删除磁盘内容。

### E2E-012 Windows 真实发布应用全生命周期

启动 release EXE 和隔离工作区，通过真实 WebView 完成扫描、纳管、编辑、AI、发布、目标漂移、回收站和恢复。记录 900×600、1280×800、高 DPI、键盘、reduced motion 和 reduced transparency 结果。该测试不得使用开发者真实 Agent 目录。

### E2E-013 三平台安装与启动

Windows、macOS、Linux 真实 Runner 分别安装或直接启动发布候选，在隔离目录完成 bootstrap、离线扫描、详情、编辑保存和回收恢复 smoke。平台原生 Secret Store 使用专用测试凭据；测试结束只清理自己创建的条目。

## 15. 性能测试

### 15.1 数据集

- 1,000 个 Skill
- 100,000 个文件
- 混合 Markdown、脚本、资源和大文件
- 10% 同名或重复
- 5% 解析错误

### 15.2 指标

| 测试 | 门槛 |
|---|---:|
| 有缓存索引的冷启动首屏 | ≤ 5 秒 |
| 搜索 P95 | < 150 ms |
| 单 Skill 详情 P95，不含 AI | < 300 ms |
| 增量修改一个 Skill | 不触发全库重解析 |
| 取消扫描 | 2 秒内停止新增工作 |
| UI 长时间监听 | 无持续性内存增长 |

性能结果记录硬件、操作系统、数据集版本和 commit。CI 可使用相对回归阈值，发布候选执行固定设备基准。

## 16. 安全测试

### 16.1 静态与依赖

- Rust `cargo audit`
- npm 依赖审计
- Secret scanning
- 许可证扫描
- 禁止危险 shell 拼接规则
- Tauri capability 审查

### 16.2 动态

- 路径穿越、Zip Slip、symlink/junction escape
- Git 参数注入
- HTML/Markdown 渲染 XSS
- 恶意巨大 Front Matter 和深层 YAML
- 数据库畸形字段
- Provider 响应注入 UI
- 日志中的凭据和敏感内容

### 16.3 破坏性操作守卫

对所有递归移动和删除执行“允许根断言”测试。测试应故意传入主目录、磁盘根、工作区父目录和链接逃逸路径，全部必须拒绝。

## 17. 故障注入

每个文件事务关键点都可注入失败：

- 创建 staging 前后
- 复制中途
- 哈希校验
- 备份目标后
- 替换目标前后
- SQLite commit 前后
- journal 写入失败
- 应用异常退出

每个注入点验证最终状态满足以下之一：旧状态完整、操作完整成功，或存在可识别且可恢复的 journal；不得出现无记录的半成品。

## 18. 回归测试

必须保留并运行上游已有测试，重点包括：

- Skill store、DB 和团队兼容集成测试
- 平台定义和嵌套 Skill 扫描
- 快照、版本比较和恢复
- 市场发现和导入
- 项目同步计划
- 前端 Dashboard、Platforms、Market、Snapshot 组件

即使团队 UI 被隐藏，相关 schema 和已有数据兼容测试仍需通过。

## 19. CI 矩阵

### 19.1 Pull Request

并行 Job：

1. `frontend-check`：typecheck、Vitest、build
2. `rust-check`：fmt、Clippy、unit、integration
3. `db-migration`：全新数据库和上游升级夹具
4. `contract-linux`：Adapter、IPC、Mock AI
5. `security-license`：秘密、依赖和许可证扫描

### 19.2 主分支

增加：

- Windows Adapter 和 Secret Store 集成
- macOS Adapter 和 Keychain 集成
- Linux Secret Service 契约
- 关键桌面 E2E
- 构建未签名测试包

### 19.3 发布候选

完整矩阵：

| Job | Windows | macOS | Linux |
|---|---:|---:|---:|
| 前后端测试 | 是 | 是 | 是 |
| 五平台 Adapter 契约 | 是 | 是 | 是 |
| Secret Store | 是 | 是 | 是/明确不可用测试 |
| 桌面 E2E | 是 | 是 | 是 |
| 安装包构建 | `.exe/.msi` | `.dmg` | `.AppImage/.deb` |
| 安装/启动 Smoke | 是 | 是 | 是 |

发布产物生成 SHA-256 校验文件，并验证不包含测试凭据、数据库、日志和用户 Skill。

## 20. 覆盖率与质量门槛

- Rust 核心纯逻辑行覆盖率目标 ≥ 85%。
- 来源可信度、路径边界、文件事务和回收站分支覆盖率目标 ≥ 90%。
- TypeScript 新增业务模块行覆盖率目标 ≥ 80%。
- 覆盖率下降必须在 PR 中解释，不以无意义测试追求数字。
- 所有 P0 用户流程必须至少有一个 E2E 或跨层集成测试。

## 21. SPEC 追踪矩阵

| SPEC 范围 | 主要测试 |
|---|---|
| INV-001～006 | Rust 扫描单元、平台主目录、增量/监听集成、E2E-001 |
| CAT-001～005 | TypeScript 列表/详情、重复测试、E2E-001/004 |
| SRC-001～005 | 可信度单元、来源夹具、用户纠正集成 |
| LIB-001～004 | 数据库事务、纳管集成、快照回归、E2E-002 |
| MAP-001～005 | Adapter 契约、发布故障注入、漂移测试、E2E-002/004 |
| IMP-001～005 | 本地/Git/ZIP 集成、计划过期、安全测试、E2E-003 |
| EDT-001～004 | 文件写入、路径边界、快照、外部编辑变更测试 |
| TRS-001～005 | 回收站集成、路径安全、故障注入、E2E-005 |
| AI-001～007 | AI 路由、Mock Provider、脱敏、降级、E2E-006/007 |
| CFG-001～004 | 设置组件、Secret Store、Provider 连接契约 |
| AUD-001～003 | 操作记录集成、日志脱敏、安全扫描 |
| UI-001～005 | 视觉快照、可访问性、ModelAttribution、E2E-008 |
| OSS-001～004 | 许可证、NOTICE、Secret scanning、产物内容检查 |
| NFR-001～007 | 跨平台矩阵、性能、安全、稳定性和可测试性检查 |

## 22. 测试报告

每次发布候选产生：

- commit 和上游基线
- 各平台测试结果
- SPEC 追踪状态
- 失败与豁免项
- 覆盖率
- 性能基准
- 安全与许可证扫描
- 安装包 Smoke Test
- 已知限制

任何豁免必须包含负责人、原因、风险、临时缓解和到期时间。

## 23. 发布阻断条件

出现以下任一情况不得发布：

1. 首次扫描修改了外部 Skill。
2. 路径穿越或越界递归删除测试失败。
3. 回收站恢复存在已知数据丢失。
4. API Key 出现在数据库、日志、构建产物或 Git。
5. 五个首要 Agent 任一核心复制映射契约失败。
6. MiniMax/OpenAI 真实域名在 CI 中被调用。
7. Windows、macOS、Linux 任一目标无法构建或启动。
8. LICENSE、NOTICE 或上游归属缺失。
9. P0 需求没有测试或书面验收记录。
10. 数据库迁移无法从上游基线安全升级。
11. 真实编辑器无法保存、保护未保存内容或创建恢复点。
12. AI 生成入口不能取消、不能显示实际模型或失败后阻断离线核心功能。
13. 平台中心或扫描根管理仍以静态数据冒充真实连接。
14. 1,000 Skill/100,000 文件发布候选基准没有执行结果或未经批准的限期豁免。
15. 独立公开仓库没有 Windows、macOS、Linux 真实 CI 结果。
16. 公开产物缺少 SBOM、第三方清单、SHA-256 或包含用户数据/密钥。

## 24. Draft 0.2 执行与验收计划

### 24.1 Gate A：文档与基线

- 四份主文档版本和需求编号一致。
- 当前主工作区干净，既有 `npm run check` 通过。
- 新任务不得撤销 `d626224` 已通过的安全、迁移和回归门槛。

### 24.2 Gate B：产品闭环自动化

新增组件与跨层测试至少覆盖：

| 范围 | 必须验证 |
|---|---|
| 编辑器 | 五类文本、只读/编辑、dirty guard、语法错误、保存失败保留、恢复点、diff、outdated |
| AI | 生成、取消、缓存、过期、强制重生成、错误分类、模型归属、自动补充开关 |
| 平台中心 | 检测、路径测试、保存、启停、治理影响、copy/symlink、局部错误 |
| 扫描根 | 列表、添加、编辑、停用、选定根扫描、磁盘零删除 |

生产页面必须通过依赖注入或 Mock IPC 测试状态，但最终契约测试还要核对真实 command 名、camelCase 参数和返回结构。

### 24.3 Gate C：Windows 真实验收

Windows 发布候选必须完成 E2E-012。允许通过桌面驱动、可访问性树或经过审核的半自动脚本执行；如果环境无法稳定驱动 WebView，必须保存逐步人工验收记录和关键截图，不能只引用单元测试。

真实 Provider 测试必须由用户明确提供测试凭据或在安全环境配置；只发送夹具内容，最多执行连接测试与一次最小摘要。没有可安全确认的凭据时，真实 MiniMax/OpenAI 必须标为 `NOT_RUN` 并列入已声明边界，不得伪造为 `PASS`、`FAIL` 或使用用户真实凭据；其余离线与 Mock Provider 验收可继续完成。

### 24.4 Gate D：性能与三平台

- 实际运行 1,000 Skill/100,000 文件基准，记录硬件、OS、commit、全量/增量/查询指标。
- 在真实 GitHub Runner 运行 Windows、macOS、Linux `npm run check`。
- 三平台执行安装包构建和启动 smoke；macOS/Linux 原生 Secret Store 与 symlink 行为有明确结果。
- 任何平台失败都回到对应开发窗口修复，修复后重跑完整矩阵。

### 24.5 Gate E：开源发布

公开 Beta 前自动或半自动验证：

1. `LICENSE`、`NOTICE`、README 上游基线和修改说明。
2. `SECURITY.md`、`CONTRIBUTING.md`、构建与数据目录文档。
3. CycloneDX 或 SPDX SBOM、第三方依赖/资产清单及许可证扫描。
4. Git 全历史秘密扫描和当前候选文件卫生扫描。
5. Windows、macOS、Linux 产物、SHA-256 和产物内容检查。
6. Release 版本、tag、变更说明和已知限制相互一致。

### 24.6 缺陷循环

验收发现缺陷时遵循同一循环：

```text
复现 -> 写失败测试或可重复脚本 -> 最小修复 -> 目标测试 -> npm run check
     -> 平台/桌面专项回归 -> 更新交接与追踪矩阵
```

只要存在发布阻断项，窗口不得返回最终完成；交接必须列出仍未通过的外部边界。总控任务在读取提交、交接文件和实际测试结果后决定继续补做、创建修复任务或进入下一 Gate。
