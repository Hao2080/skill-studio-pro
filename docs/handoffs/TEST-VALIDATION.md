# Skill Studio Pro 测试与发布质量验证

日期：2026-07-16（Asia/Shanghai）

分支：`wave-0-baseline`

验证基线：`3bbdfe7 docs: hand off UI backend integration`
范围：实现完成后的独立 QA、缺口补测、最小缺陷修复、Windows 桌面打包/启动 smoke 与发布门槛审计。

## 1. 结论

本轮不是对已有测试的复述。先按 SPEC、PRD、AUTOMATED-TESTING 逐项审计，再补充跨层契约、迁移、安全、生命周期和桌面结构测试。所有测试都使用临时目录、浏览器 Mock 或本机 Mock HTTP Provider；没有执行任何 Skill 脚本，没有访问 MiniMax/OpenAI 真实计费端点，没有向外部 Agent 发布，也没有读写真实用户 Skill 或真实 Credential Manager 条目。

最终本机 Windows 结果：

- TypeScript/Vitest：53 个测试文件，268 passed，2 skipped；两个 skip 是既有的 SettingsPage 简化 UI 用例，见第 8 节。
- Rust：109 passed；另有 1 个 release-candidate 性能基准明确 ignored。Windows Credential Manager 集成用例在本机因未设置隔离 CI 开关而安全返回，不访问真实凭据；Windows CI 使用独立 Runner 时才启用。
- Windows NSIS：打包成功；release EXE 在隔离 HOME/config/workspace 下启动成功并完成数据库、manifest 和目录 bootstrap。
- 安全：当前 tracked/unignored 候选文件卫生扫描通过；`npm audit --audit-level=high` 为 0；Windows 临时 junction 越界测试通过；NSIS 内容清单无用户数据库、日志、回收站、staging、Skill 或密钥。
- 三平台：CI/Release YAML 和命令契约已自动化，YAML 本机可解析；本机只实际执行 Windows，未声称执行 macOS/Linux。

状态图例：`已覆盖` 表示存在可重复自动化断言；`部分覆盖` 表示核心语义已自动化但仍缺真实桌面、真实 OS 或极端条件；`尚未自动化` 表示规划项没有有效自动化；`人工/真实平台` 表示本质上需要发布平台、凭据服务、签名或视觉人工验收。

## 2. SPEC 逐项追踪矩阵

### 2.1 发现、目录与来源

| SPEC | 状态 | 自动化证据与边界 |
|---|---|---|
| INV-001 | 已覆盖 | `inventory_integration` 验证五个首要 Agent 的注入 Home 发现，Platform 定义单元测试验证默认/覆盖路径。 |
| INV-002 | 已覆盖 | 新增单次扫描两个根，并发现嵌套 `.system` 与插件缓存 Skill；根锁与独立结果已验证。 |
| INV-003 | 已覆盖 | 全量/增量集成测试在扫描前后比较来源文件哈希和 mtime；扫描器测试确认只索引、不执行脚本。 |
| INV-004 | 已覆盖 | 全量后修改单一 Skill，再做增量扫描；变更数量、错误隔离和取消状态均有断言。 |
| INV-005 | 部分覆盖 | watcher 去抖/合并是单元测试；尚无多小时真实 OS 文件监听稳定性 E2E。 |
| INV-006 | 已覆盖 | BOM、CRLF、缺 Front Matter、坏 YAML、嵌套描述、风险标记和文件列表均覆盖。 |
| CAT-001 | 已覆盖 | 本机列表 API、列表页加载/空/错误/局部成功状态及数量展示均有组件测试。 |
| CAT-002 | 已覆盖 | 名称、平台、来源、可信度、风险与纳管状态筛选有 store/UI 测试；极大列表性能另列 NFR-002。 |
| CAT-003 | 已覆盖 | 详情 API 与 UI 测试覆盖元数据、来源、文件、平台、风险、AI 归属和状态。 |
| CAT-004 | 已覆盖 | `inventory_instance_file_read`、SKILL.md 原文入口和浏览器/Tauri 命令注册契约已覆盖。 |
| CAT-005 | 已覆盖 | 同名同内容、同名异内容、同内容异名的 Rust 重复关系测试及冲突 UI 已覆盖。 |
| SRC-001 | 已覆盖 | 本地导入、Git、插件、系统、平台扫描、未知和人工来源均有证据/集成夹具。 |
| SRC-002 | 已覆盖 | `SourceEvidence`、安装 provenance、插件 manifest、Git remote/ref/commit/subdir 均断言持久化。 |
| SRC-003 | 已覆盖 | 确定性权重、冲突扣分、自动上限 99、UI 百分比和文字状态有断言。 |
| SRC-004 | 已覆盖 | 推断与 confirmed 分离；用户确认固定为 100，并明确保留原证据。 |
| SRC-005 | 已覆盖 | `user_confirmation_overrides_recalculation_but_keeps_evidence` 防止后续自动推断覆盖人工确认。 |

### 2.2 中央库、映射、导入、编辑与回收站

| SPEC | 状态 | 自动化证据与边界 |
|---|---|---|
| LIB-001 | 已覆盖 | 中央 workspace/skills 主副本、外部实例只读和单平台移除不删主副本由集成测试覆盖。 |
| LIB-002 | 已覆盖 | 纳管计划、复制、来源关系、初始快照和稳定 UUID（改 slug 不改 storage identity）均覆盖。 |
| LIB-003 | 已覆盖 | 活跃快照、保存恢复点、更新冲突恢复点和重复迁移不重复活跃快照均覆盖。 |
| LIB-004 | 已覆盖 | 内容哈希、快照哈希、发布/目标观测哈希与漂移状态均有断言。 |
| MAP-001 | 已覆盖 | 五个首要 Agent 的一对多 Adapter 契约和多目标发布覆盖。 |
| MAP-002 | 已覆盖 | copy/symlink 能力探测，失败时不静默降级；本机 junction/链接边界另有安全测试。 |
| MAP-003 | 已覆盖 | 发布 plan 明确目标列表，多目标部分成功逐目标报告。 |
| MAP-004 | 已覆盖 | 目标外部修改触发 drift；过期/陈旧 plan 拒绝执行。 |
| MAP-005 | 已覆盖 | 每个文件事务故障点、备份后失败恢复、所有权 marker 保护和 DB/文件状态覆盖。 |
| IMP-001 | 已覆盖 | 本地目录、Git、ZIP、market 统一进入 staging/preview 管线；不调用真实网络市场。 |
| IMP-002 | 已覆盖 | 文件数、体积、来源、commit、脚本、候选、冲突、目标和 plan hash 返回结构有集成/IPC 契约。 |
| IMP-003 | 已覆盖 | 扫描/导入只读内容并标记脚本，测试无 Skill 脚本执行路径。 |
| IMP-004 | 已覆盖 | provenance、快照、中央 Skill、操作记录及 publishDeferred 均断言。 |
| IMP-005 | 已覆盖 | skip/rename/update recovery point 三种冲突策略和 stale plan 覆盖。 |
| EDT-001 | 已覆盖 | 中央 Skill 文本文件保存、支持类型与相对路径边界覆盖；外部实例不能直接写入中央编辑 API。 |
| EDT-002 | 已覆盖 | 同目录临时文件、flush/sync、Windows 原子替换、失败保留旧文件及 symlink/junction escape 覆盖。 |
| EDT-003 | 已覆盖 | 首次保存恢复点、before/after hash、映射 outdated 和恢复快照覆盖。 |
| EDT-004 | 部分覆盖 | 外部编辑器命令与外部变更/漂移状态有 API/状态测试；尚无真实编辑器进程往返 E2E。 |
| TRS-001 | 已覆盖 | 中央 Skill 默认移动至应用回收站，manifest、原路径、来源和映射保留。 |
| TRS-002 | 已覆盖 | 删除 plan 的路径、文件数、体积、影响映射、hash 与过期验证覆盖。 |
| TRS-003 | 已覆盖 | 原位恢复、目标冲突拒绝覆盖、改名恢复和 manifest 恢复覆盖。 |
| TRS-004 | 已覆盖 | 仅 trash entry ID + 短期 token 可永久删除；过期 token 和错误 ID 拒绝。 |
| TRS-005 | 已覆盖 | 数据库解析路径、允许根、应用所有权、root 删除、symlink/junction 与任意路径拒绝覆盖。 |

### 2.3 AI、设置、审计与 UI

| SPEC | 状态 | 自动化证据与边界 |
|---|---|---|
| AI-001 | 已覆盖 | MiniMax `extract_usage`、OpenAI `final_summary` 默认路由和可配置 route 持久化覆盖。 |
| AI-002 | 已覆盖 | 只有显式 generate 命令调用 Mock Provider；取消 ID 与并发服务均覆盖。 |
| AI-003 | 已覆盖 | artifact 保存 provider、实际 model ID、职责、prompt version、input hash、时间和状态；ModelAttribution UI 覆盖。 |
| AI-004 | 已覆盖 | 原始 SKILL.md 与 AI artifact 分离，缺 AI/缺凭据不影响本地查看。 |
| AI-005 | 已覆盖 | 相同输入命中缓存、force/输入与配置变化走新调用、stale 状态在 UI 可见。 |
| AI-006 | 已覆盖 | 缺凭据在联网前失败；Mock 覆盖超时、取消、允许重试、一次结构修复和错误分类。 |
| AI-007 | 已覆盖 | API Key、Bearer、PEM、JWT、常见 token 阻断/脱敏，Provider 错误正文与操作日志不泄密。 |
| CFG-001 | 已覆盖 | MiniMax/OpenAI provider 和 route 设置页、保存/清空输入、连接测试状态有组件/API 契约。 |
| CFG-002 | 部分覆盖 | memory/process-only/SystemCredentialStore 契约与“不退回明文”覆盖；本机不触碰真实凭据，三 OS 原生 Secret Store 只允许隔离 CI/真实平台验证。 |
| CFG-003 | 已覆盖 | UI 展示 provider、实际 model ID、职责及启用状态，不以配置显示名冒充实际返回。 |
| CFG-004 | 已覆盖 | MiniMax/OpenAI Mock HTTP 连接、鉴权、超时和错误分类覆盖；真实服务连接必须人工显式授权。 |
| AUD-001 | 已覆盖 | 安装、编辑、发布、删除、恢复、AI 调用的 operation/log 持久化与列表契约覆盖。 |
| AUD-002 | 已覆盖 | Activity 页加载、错误、部分成功及逐目标结果的组件测试覆盖。 |
| AUD-003 | 已覆盖 | 操作错误、HTTP 错误和 AI 输入的密钥/正文脱敏测试及仓库秘密扫描覆盖。 |
| UI-001 | 部分覆盖 | 品牌文案/导航和主题 token 有结构测试；品牌视觉仍需人工像素验收。 |
| UI-002 | 部分覆盖 | 深海蓝主题、层级、模糊/透明 token 和 reduced transparency 结构断言通过；未做截图基准。 |
| UI-003 | 部分覆盖 | 900×600 最小窗口、1280×800 默认窗口、900/1100 响应断点和导航折叠 DOM 测试通过；像素拥挤度需人工。 |
| UI-004 | 部分覆盖 | axe 组件测试、自然 tabIndex、全局搜索快捷键、`:focus-visible`、reduced motion/transparency 覆盖；真实屏幕阅读器、焦点陷阱全流程和色彩对比人工。 |
| UI-005 | 已覆盖 | Provider 状态、模型职责和 AI 最新/过期/失败/禁用文本状态有组件测试。 |

### 2.4 开源与非功能需求

| SPEC | 状态 | 自动化证据与边界 |
|---|---|---|
| OSS-001 | 人工/真实平台 | 仓库文件存在，但“公开发布”及公开可构建性只能在真实 GitHub/Release 验证。 |
| OSS-002 | 部分覆盖 | LICENSE、NOTICE、README/上游说明纳入仓库审计；法律文本完整性仍需维护者确认。 |
| OSS-003 | 部分覆盖 | 第三方依赖锁文件和品牌资产路径可追踪；完整第三方许可证/SBOM 法务审计尚未自动化。 |
| OSS-004 | 已覆盖 | 新增 tracked/unignored 文件卫生与高可信秘密扫描；NSIS 8 项内容清单无用户数据；CI Gitleaks 扫完整历史。 |
| NFR-001 | 部分覆盖 | CI 和 Release 三平台命令契约已锁定；本机只运行 Windows，macOS/Linux 实际执行属真实 CI 边界。 |
| NFR-002 | 尚未自动化 | 1,000 Skill/100,000 文件基准存在但默认 ignored；500 Skill 首批结果 60 秒和 99%/95% 准确率未在本轮执行。 |
| NFR-003 | 已覆盖 | 取消、超时、重试、并发锁、部分成功、文件事务故障注入和 crash journal 恢复覆盖。 |
| NFR-004 | 已覆盖 | traversal、UNC/绝对路径、symlink/junction、所有权、Git 参数/协议、ZIP slip/体积和密钥脱敏覆盖。TOCTOU 极限竞争仍列人工。 |
| NFR-005 | 部分覆盖 | AI 可选、Mock 网络、最小发送与敏感内容阻断覆盖；真实系统抓包/代理验证未执行。 |
| NFR-006 | 已覆盖 | TypeScript strict、fmt/check/clippy `-D warnings`、跨层契约和 CI 门禁通过。 |
| NFR-007 | 已覆盖 | 临时目录、Mock Provider、可注入 Home/config/workspace 和浏览器/IPC 契约满足隔离测试；无真实用户数据依赖。 |

## 3. PRD 追踪摘要

| PRD 条目 | 状态 | 对应验证 |
|---|---|---|
| §4 用户核心诉求、§5 产品原则、§6.1 第一代目标 | 部分覆盖 | 盘点、解释、来源、中央库、映射、恢复、AI 可选等核心语义已自动化；三平台发布和完整桌面体验仍有真实平台边界。 |
| §8.1 总览页 | 已覆盖 | 加载、统计、扫描/Provider 状态、最近操作的组件与 API Mock 测试。 |
| §8.2 本机 Skill 页 | 已覆盖 | 列表、筛选、风险、来源可信度、错误/空/部分成功状态。 |
| §8.3 Skill 详情页 | 已覆盖 | 概览、原文、文件、来源、安装位置、ModelAttribution 和过期状态。 |
| §8.4 中央库页 | 已覆盖 | 快照、发布、漂移、移除映射、编辑和回收站动作的组件/服务集成。 |
| §8.5 平台中心 | 部分覆盖 | 五 Adapter 契约和平台 UI 状态覆盖；两个既有“手工目录/同步结果”SettingsPage 用例仍 skip。 |
| §8.6 发现与安装页 | 已覆盖 | 本地/Git/ZIP/market preview、冲突、plan stale、部分成功和来源记录。 |
| §8.7 编辑工作区 | 部分覆盖 | 文件树/保存/恢复点/差异状态/发布选择覆盖；真实外部编辑器交互人工。 |
| §8.8 回收站页 | 已覆盖 | 删除计划、恢复、改名恢复、短期 token 永久删除、两步确认 UI。 |
| §8.9 操作记录页 | 已覆盖 | 加载/错误/部分成功/逐平台结果和脱敏日志。 |
| §8.10 设置页 | 部分覆盖 | Provider/route/API Key 清理与隐私选项覆盖；平台手工目录简化 UI 是已知缺口。 |
| §9.1 首次启动 | 部分覆盖 | 实际 Windows 隔离 bootstrap + inventory/UI 各层覆盖，但没有自动点击完整 onboarding。 |
| §9.2 查看一个 Skill | 部分覆盖 | 列表→详情→原文→按需 Mock AI 各层覆盖，尚无单一桌面驱动 E2E。 |
| §9.3 纳入中央库 | 已覆盖 | plan→确认→复制→快照→来源→可选多 Agent 发布完整服务集成。 |
| §9.4 GitHub 安装 | 部分覆盖 | 本地临时 Git 仓库完整闭环和部分成功覆盖；真实 GitHub 网络中断/代理人工。 |
| §9.5 编辑并同步 | 已覆盖 | 恢复点→原子保存→outdated→漂移→策略/取消由服务集成覆盖。 |
| §9.6 单平台移除 | 已覆盖 | 所有权保护、只移除 mapping、中央主副本保留。 |
| §9.7 删除和恢复 | 已覆盖 | plan→trash→冲突→改名→恢复→二次确认 purge 闭环。 |
| §9.8 配置模型 | 部分覆盖 | Provider/route/连接测试在 UI + Mock HTTP 覆盖；真实付费 Provider 明确未调用。 |
| §10.1 MiniMax、§10.2 GPT-5.6、§10.3 用户可见信息 | 已覆盖 | 默认职责、结构化输出、一次修复、实际模型与归属组件均覆盖。 |
| §11 来源可信度表达 | 已覆盖 | 结论、状态、百分比、依据、纠正入口和非颜色唯一表达组件测试。 |
| §12 品牌与视觉 | 部分覆盖 | DOM/CSS/窗口契约覆盖；无截图像素基线。 |
| §13 P0：多 Agent 扫描/目录/来源/中央库/导入/编辑/回收站/AI | 已覆盖 | 对应 SPEC 闭环测试均通过。 |
| §13 P0：深海蓝 Pro 主题 | 部分覆盖 | token、reduced effects 和响应结构覆盖；视觉人工验收未完成。 |
| §13 P0：Windows/macOS/Linux 构建 | 部分覆盖 | Windows NSIS 实际通过；三平台 workflow 契约通过；macOS/Linux 本机未执行。 |
| §14 指标 1/2：99% 发现、95% 来源准确率 | 尚未自动化 | 缺带真值的大型准确率数据集与报告。 |
| §14 指标 3：500 Skill 首批结果 ≤60 秒 | 尚未自动化 | 候选性能基准默认 ignored，本轮未冒充通过。 |
| §14 指标 4：核心流程无不可恢复数据丢失 | 已覆盖 | 文件事务故障点、journal、恢复点、trash、部分成功和所有权保护。 |
| §14 指标 5：五 Agent 契约 | 已覆盖 | 五个 Adapter 共享完整发布/漂移/移除契约。 |
| §14 指标 6：离线核心可用 | 部分覆盖 | 所有自动化使用临时本地数据/Mock；未做系统级断网桌面 E2E。 |
| §14 指标 7：全部 P0 自动化 | 部分覆盖 | 安全语义覆盖充分，仍缺像素、真实三 OS 与完整桌面驱动 E2E。 |
| §16.1～§16.3 开源、归属、第三方 | 部分覆盖 | 仓库静态文件可审计；公开 Release、法律/SBOM 需维护者/真实平台。 |
| §16.4 发布包无用户数据 | 已覆盖 | 仓库卫生扫描 + Windows NSIS 7-Zip 内容清单。 |
| §16.5 SECURITY/CONTRIBUTING/依赖清单 | 部分覆盖 | 文件存在性可审计；发布前内容维护仍属人工责任。 |
| §16.6 三平台 Release 校验文件 | 人工/真实平台 | workflow 有 checksum 步骤，但真实三平台 Release 尚未运行。 |

## 4. AUTOMATED-TESTING.md 追踪矩阵

### 4.1 明确测试 ID

| 测试计划 ID | 状态 | 实现/缺口 |
|---|---|---|
| UT-INV-001 | 已覆盖 | 标准 SKILL.md 候选。 |
| UT-INV-002 | 已覆盖 | `.system` 多根集成。 |
| UT-INV-003 | 已覆盖 | BOM/CRLF parser。 |
| UT-INV-004 | 已覆盖 | 坏 YAML 保留 error 实例。 |
| UT-INV-005 | 已覆盖 | 无 SKILL.md 不登记。 |
| UT-INV-006 | 已覆盖 | Unix symlink loop；Windows junction 越界守卫。 |
| UT-INV-007 | 尚未自动化 | 稳定复现单目录权限错误并继续扫描，需 OS 专用夹具。 |
| UT-INV-008 | 尚未自动化 | 大文件分块哈希的峰值内存断言未实现。 |
| UT-INV-009 | 已覆盖 | 嵌套两个 Skill 和插件/系统根。 |
| UT-INV-010 | 已覆盖 | 取消、cancelled 状态和根锁释放。 |
| UT-SRC-001～005 | 已覆盖 | 0/15/50/85/80 五组确定性例子逐项断言。 |
| UT-SRC-006 | 已覆盖 | 自动证据显式断言封顶 99。 |
| UT-SRC-007 | 已覆盖 | 人工确认 100/confirmed。 |
| UT-SRC-008 | 已覆盖 | 强冲突扣分和依据。 |
| UT-SRC-009 | 部分覆盖 | evidence hash 随证据变化并重算覆盖；算法常量版本升级的跨版本夹具未单独实现。 |
| UT-SRC-010 | 已覆盖 | MiniMax 候选不能提高确定性分数。 |
| E2E-001 首次启动离线盘点 | 部分覆盖 | Windows 实际 bootstrap + UI/扫描集成；无桌面自动点击。 |
| E2E-002 纳管并发布 | 部分覆盖 | 服务级完整闭环和 UI/IPC 契约；无桌面自动点击。 |
| E2E-003 Git 安装 | 部分覆盖 | 临时 Git 完整闭环；无真实网络桌面 E2E。 |
| E2E-004 编辑、漂移与冲突 | 部分覆盖 | 服务闭环与 UI 状态覆盖；无像素/桌面驱动。 |
| E2E-005 删除与恢复 | 部分覆盖 | 服务闭环 + 两步 UI；无桌面驱动。 |
| E2E-006 模型配置与摘要 | 部分覆盖 | UI + Mock Provider；禁止真实计费。 |
| E2E-007 Provider 故障降级 | 部分覆盖 | Mock timeout/cancel/error/retry；无真实网络栈。 |
| E2E-008 窗口和可访问性 | 部分覆盖 | 窗口配置、DOM/CSS/axe；像素和辅助技术人工。 |

### 4.2 章节级覆盖

| 测试计划章节 | 状态 | 说明 |
|---|---|---|
| §6.2 哈希与重复 | 部分覆盖 | 排序独立、重复三关系、漂移覆盖；CRLF/LF 差异和 ignore 文件哈希规则缺显式用例。 |
| §6.4 路径安全 | 部分覆盖 | traversal、绝对路径、root、symlink/junction、非所有权、恢复冲突、Zip Slip 覆盖；UNC/不同盘已有校验，TOCTOU 竞争未自动化。 |
| §6.5 文件事务 | 已覆盖 | staging、backup、DB/文件故障、journal、部分成功、锁覆盖。 |
| §6.6 AI 规则与脱敏 | 已覆盖 | 路由、缓存、结构修复、API Key/Bearer/PEM/JWT、日志脱敏。 |
| §7 TypeScript 组件 | 部分覆盖 | 列表、详情、归属、高风险、axe、键盘、reduced effects 覆盖；1000 项 UI、焦点陷阱和自动对比度不完整。 |
| §8.1 全新数据库 | 已覆盖 | 空库 schema v4、表/索引/default seed 和重复启动。 |
| §8.2 上游升级 | 部分覆盖 | v1/v2/v3→v4、sentinel 保留、幂等和 v99 不降级；不是逐字节真实历史 DB fixture，迁移失败备份未覆盖。 |
| §8.3 事务一致性 | 已覆盖 | 文件/DB 故障、外键、部分成功和 trash 恢复。 |
| §8.4 并发 | 部分覆盖 | 根锁、Skill 写锁和 busy timeout 配置覆盖；高并发 UI 查询压力未执行。 |
| §9 Platform Adapter | 已覆盖 | 五首要 Agent 完整通用契约；三 OS 实际由 CI matrix 执行，本机只 Windows。 |
| §10 导入与生命周期 | 已覆盖 | 本地/Git/ZIP/market、stale、体积、冲突、编辑、trash、journal。 |
| §11 AI Provider | 部分覆盖 | MiniMax/OpenAI 非流式 Mock、鉴权、实际模型、usage、修复、重试、超时/取消覆盖；Mock 流式解析和部分错误类别未逐项。 |
| §12 Secret Store | 部分覆盖 | memory/process/system abstraction 覆盖；三平台原生服务必须隔离 CI。 |
| §13 Tauri IPC | 部分覆盖 | 所有 Pro 命令名、camelCase 参数、返回 envelope 和注册 guard；真实 Tauri Mock IPC 在非 Windows CI 运行，Windows mock WebView2 loader 不兼容，Windows 用实际 EXE smoke。AppError 全字段/进度单调仍缺统一生成契约。 |
| §15 性能 | 尚未自动化 | 大基准存在但 ignored，未采集本轮性能数据。 |
| §16 安全 | 部分覆盖 | 代码/依赖/tracked tree/包内容和动态路径输入覆盖；本机无 Gitleaks/cargo-audit，历史由 CI Gitleaks。 |
| §17 故障注入 | 已覆盖 | 发布各阶段、编辑/删除 journal、Provider timeout/cancel/retry。 |
| §18 回归 | 已覆盖 | 本轮发现的产品缺陷均有回归测试，见第 6 节。 |
| §19 CI 矩阵 | 已覆盖（契约） | ubuntu/windows/macos 均明确执行 npm ci、typecheck/test/build、Rust fmt/check/clippy/test；Release 三平台先跑 `npm run check`。实际远端运行需 GitHub。 |
| §20 覆盖率门槛 | 部分覆盖 | 全部门禁通过；仓库尚未配置 Rust/TS 行覆盖率百分比阻断。 |

## 5. 新增测试与既有覆盖范围

本轮新增 16 个测试函数/用例，其中 Windows 本机执行 15 个，1 个真实 Tauri Mock IPC 用例因 Windows WebView2 test-loader 入口点兼容问题限定在非 Windows CI：

- Rust 新增/扩展：多扫描根 + 嵌套 system/plugin；来源分数 99 上限；文件 root/symlink/Windows junction；ZIP/复制文件数、单文件和总量上限；Git option/protocol 注入；恢复冲突、改名恢复、过期 purge token；API Key/Bearer/PEM/JWT 脱敏；空/v1/v2/v3/v99 迁移幂等；全 Pro 命令注册和非 Windows 真实 Tauri IPC camelCase。
- TypeScript 新增：全 Pro 浏览器预览命令名/camelCase/envelope 契约；Tauri 窗口 1280×800/最小 900×600、CSS 断点、focus/reduced motion/reduced transparency；CI/Release 三平台命令契约；应用 900/1280 导航与键盘自然焦点。
- 既有关键闭环继续通过：inventory 取消/增量/坏 YAML/只读、五 Agent 发布/漂移/部分成功/所有权、导入/编辑/trash/journal、MiniMax/OpenAI Mock Provider、UI 加载/空/错误/部分成功/ModelAttribution/API Key 清理/两步永久删除。

## 6. 发现并修复的缺陷

| 缺陷 | 复现 | 最小修复 | 回归 |
|---|---|---|---|
| 浏览器预览恢复错误的回收站条目 | 对 `trash-2` 建 restore plan 后 execute，旧 Mock 硬编码删除 `trash-1`。 | restore plan 保存目标 entry ID；execute 按 plan entry 恢复并返回 `status/restoredAt`。 | `proIpcContract.test.ts` 依序 plan/execute/purge，锁定 ID 和返回 envelope。 |
| 打包桌面无法安全覆盖 Windows KnownFolder，QA smoke 可能碰真实 Home/workspace | 仅设置 HOME/USERPROFILE 时，`dirs::home_dir/config_dir` 仍解析真实 Windows 用户目录。 | 增加只接受绝对路径的 `SKILL_STUDIO_PRO_HOME/CONFIG_HOME/WORKSPACE` 覆盖，inventory/library/trash 统一使用 workspace Home 解析。 | 实际 release EXE 在独立临时根创建 DB/config/manifest/目录并保持运行。 |
| 本机精确 `cargo test` 会操作真实 Windows Credential Manager 测试条目 | 原测试在任何 Windows 开发机都 set/get/delete 本机系统凭据。 | 原生凭据集成仅在显式 `SKILL_STUDIO_PRO_NATIVE_SECRET_STORE_TEST=1` 时运行；CI 只在隔离 Windows Runner 设置。 | 本机完整 Rust 门禁未设置开关且没有改 Credential Manager；memory/process-only 契约仍运行。 |
| CI 聚合输出不明确，Release 可在未跑完整门禁时打包；clippy 组件未显式安装 | 审计 workflow 可见 baseline 只有聚合 `npm run check`，release 直接 Tauri build。 | CI 拆分所有命令并安装 clippy；三平台 Release 在打包前统一 `npm run check`；增加 workflow 契约测试。 | `CiWorkflowContract.test.ts` + PyYAML 解析。 |
| tracked 用户数据/密钥缺少本地可复现阻断 | Gitleaks 仅在远端 CI，本机无工具时没有替代门槛。 | 新增 `npm run security:repo`，扫描 tracked + unignored 候选路径和高可信 key/Bearer/PEM/JWT；纳入 `npm run check` 和 CI。 | 本机 537 个候选文件通过，CI 继续用 fetch-depth 0 Gitleaks 扫历史。 |

未把测试夹具错误或环境工具缺失记录成产品缺陷：迁移矩阵第一次把真正空库误当成带 sentinel 的旧库，已修复夹具；Windows `tauri::test` Mock WebView 进程的 `STATUS_ENTRYPOINT_NOT_FOUND` 是当前 WebView2 test loader 环境问题，release 产品 EXE 已实际启动通过。

## 7. 安全审计

- 路径：`../`、绝对路径、允许根本身、非应用所有权目标、symlink、Windows junction、恢复目标占用均拒绝；当前 Windows junction 是实际临时 junction，不是条件跳过。
- Git：URL/ref option 注入、换行、`ext::`/不安全协议在执行 Git 前拒绝；Git 调用使用参数数组；测试只访问临时本地仓库。
- ZIP/导入：Zip Slip 被拒绝；文件数、单文件大小、解压/复制总量上限直接测试；没有执行归档内脚本。
- 脱敏：API Key、Bearer、PEM private key、JWT、赋值型 secret、Provider 错误正文和操作日志均有阻断/移除断言。
- 仓库：`npm run security:repo` 检查 DB/WAL/SHM、日志、trash、staging、Agent 目录、本机 SKILL.md、env/credential/secrets 文件及高可信秘密模式。
- 依赖：`npm audit --audit-level=high` → `found 0 vulnerabilities`。
- 包：7-Zip 列出 NSIS 8 项，仅 NSIS DLL/位图、`skill-studio-pro.exe`、`uninstall.exe`；无用户数据或运行时目录。
- 本机工具边界：Gitleaks、actionlint、cargo-audit 均不可用。替代命令为 `npm run security:repo`（当前树）和 PyYAML 解析（语法）；局限是本机替代扫描不遍历 Git 历史、不做 Rust advisory 数据库审计、不等同 actionlint 的 GitHub 表达式语义检查。CI 仍用 `fetch-depth: 0` + `gitleaks/gitleaks-action@v2` 扫历史。

## 8. Windows 桌面打包与 smoke

命令：`npm run tauri -- build --bundles nsis`

- 结果：PASS，release profile 完成，NSIS 生成 `src-tauri/target/release/bundle/nsis/Skill Studio Pro_0.1.0_x64-setup.exe`。
- 产物大小：5,724,021 bytes；7-Zip 可识别为 NSIS-3 Unicode。
- 启动：直接启动本次构建的 `src-tauri/target/release/skill-studio-pro.exe`，设置三个隔离绝对路径覆盖。
- 观察：进程保持运行；独立目录中生成 `metadata.db`、`workspace.json`、`workspace-config.json`、skills/projects/snapshots/imports/staging/trash/logs/team；随后只终止本次 PID。
- 未执行：安装器实际安装/卸载、代码签名、UI 自动点击、像素截图。构建未受签名阻塞；这不代表生产签名已配置。

响应式与辅助模式自动化：Tauri 配置锁定默认 1280×800、最小 900×600；DOM 测试分别触发 900 和 1280 导航状态；CSS 断言覆盖 900/1100 断点、滚动容器、`:focus-visible`、`prefers-reduced-motion`、应用 reduced motion 和 reduced transparency（blur=0）。没有把未做的像素检查写成通过。

## 9. 三平台 CI 与本机边界

`.github/workflows/ci.yml` 的 `ubuntu-latest`、`windows-latest`、`macos-latest` matrix 逐平台明确运行：

1. `npm ci`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`
5. `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
6. `cargo check --manifest-path src-tauri/Cargo.toml`
7. `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
8. `cargo test --manifest-path src-tauri/Cargo.toml`

Rust cache workspace 为 `src-tauri`，toolchain 显式安装 rustfmt/clippy。秘密 job 使用完整历史 checkout、本地卫生脚本和 Gitleaks。Release 的 Linux/Windows/macOS 三个 job 均在 Tauri build 前执行 `npm run check`，并保留平台包与 checksum 步骤。

本机仅验证 Windows 命令、Windows NSIS 和 Windows启动。PyYAML 解析两个 workflow 且契约测试通过，但没有远程触发 GitHub Actions，所以 macOS/Linux 的编译、原生 Secret Store、包格式、签名/公证和 checksum 产物仍需真实 Runner 结果。

## 10. 最终门禁命令与结果

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | PASS |
| `npm run test` | PASS：53 files；268 passed；2 skipped |
| `npm run build` | PASS：2303 modules transformed |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS：109 passed；1 ignored performance benchmark |
| `npm run check` | PASS（最终提交前重新运行，含全部以上项目、`cargo check` 和仓库卫生扫描） |
| `npm run security:repo` | PASS：537 tracked/unignored candidate files |
| `npm audit --audit-level=high` | PASS：0 vulnerabilities |
| PyYAML parse CI + Release | PASS |
| `npm run tauri -- build --bundles nsis` | PASS |
| isolated release EXE bootstrap smoke | PASS |
| 7-Zip NSIS content listing | PASS：8 expected entries only |

既有 skip/ignore：

- `SettingsPage.test.tsx` 两项平台手工目录/最新同步结果 UI 用例，当前页面简化而 skip；这是 PRD §8.5/§8.10 的明确剩余缺口。
- `inventory_performance.rs` 的 1,000 Skill/100,000 文件 release-candidate benchmark 默认 ignored，本轮没有运行或宣称性能达标。

## 11. 仍需人工或真实平台验收的精确清单

1. 在 Windows/macOS/Linux 原生桌面分别做 900×600、1280×800、125%/150% DPI 的像素截图对比，检查截断、横向滚动、模糊层和信息密度。
2. 用真实键盘逐页验证 Tab 顺序、对话框 focus trap、关闭后焦点恢复、全局快捷键冲突；用 NVDA/VoiceOver/Orca 和对比度工具验收。
3. 在三个 OS 的系统“减少动态效果/降低透明度”设置下观察真实 WebView 行为。
4. 触发真实 GitHub CI，保存 Windows/macOS/Linux baseline、Gitleaks 和 Release 包/校验文件结果；macOS 签名/公证、Windows 签名、Linux 包安装均未在本机验证。
5. 在隔离 CI 用户下启用 Windows Credential Manager、macOS Keychain、Linux Secret Service 集成；本机 QA 按约束未改真实凭据。
6. 如发布前需要真实 MiniMax/OpenAI 连接测试，必须由维护者提供专用低权限测试凭据并显式授权；本轮没有调用真实付费模型。
7. 执行 ignored 的 1,000/100,000 性能基准，以及带真值数据集的 500 Skill 首批 ≤60 秒、发现 99%、来源 95% 指标。
8. 增加真实 OS 权限错误、长时 watcher、TOCTOU 竞争、Git 网络中断/代理、流式 Provider 和系统级断网桌面 E2E。
9. 恢复 SettingsPage 的平台手工目录/最新同步 UI 两项 skip，或由产品明确降级 PRD。
10. 由维护者完成第三方许可证/SBOM、公开仓库可复现构建和发布说明的法律/发布审阅。

## 12. 提交

实现基线：`3bbdfe7`。本轮 QA 代码、测试、workflow 与本文档在 `wave-0-baseline` 提交；最终提交哈希以交接回复和 `git log -1 --oneline` 为准。
