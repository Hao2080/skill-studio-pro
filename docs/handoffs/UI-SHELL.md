# Skill Studio Pro UI Shell 交接

状态：`HANDOFF_READY`  
完成日期：2026-07-15  
独立 worktree：`E:\AIHHao_Data\Codex_Xiangmu\Skills-All-in-ui-shell`

## 1. 分支和 commit

- 分支：`wave-1-ui-shell`
- UI、品牌、Mock 页面与测试代码提交：`64dbd379f1340149dffaf0f0e2deebd948952b17`
- 基线提交：`c66c8f6738c1912b269e648ffc79328ee5841c8d`
- 本文件在代码提交后单独提交；最终交接提交以 `git rev-parse HEAD` 为准。
- 开始实现前已确认原 `wave-0-baseline` 是唯一主 worktree；本模块随后创建上述独立 worktree，未在基线 worktree 中写入代码。

## 2. 页面完成情况

| 页面 | 路由 | 状态 | 说明 |
|---|---|---|---|
| 总览 | `/` | 完成 Mock 框架 | 指标、扫描健康、来源分布、模型状态、最近操作 |
| 本机 Skill | `/inventory` | 完成 Mock 框架 | 搜索、平台/来源/风险组合筛选、卡片/列表切换、状态标记 |
| Skill 详情 | `/inventory/:skillId`、`/library/:skillId` | 完成 Mock 框架 | 七个标签页、原文、文件、来源、位置、版本、操作记录 |
| 中央库 | `/library` | 完成 Mock 框架 | 主副本、映射、未发布和漂移摘要 |
| 平台中心 | `/platforms` | 完成 Mock 框架 | 五个首要 Agent、检测状态、目录、复制模式和同步状态 |
| 发现与安装 | `/discover` | 完成 Mock 框架 | 本地/ZIP/Git/市场入口与 Git 安装计划预览 |
| 回收站 | `/trash` | 完成 Mock 交互 | 恢复、影响预览、精确名称二次确认；不执行真实删除 |
| 操作记录 | `/activity` | 完成 Mock 框架 | 搜索、结果筛选、状态与下一步 |
| 设置 | `/settings` | 完成 Mock 框架 | 外观、辅助功能、本地数据、扫描和关于 |
| 模型与 API | `/settings/ai` | 完成 Mock 交互 | MiniMax/OpenAI 配置、掩码 Key、连接测试、职责和模型 ID |

第一代不使用的团队空间与项目空间已从导航隐藏。为兼容旧书签，`/workspace`、`/market`、`/projects/*` 和 `/teams/*` 保留重定向，不删除上游代码或数据库兼容模块。

## 3. 新增组件和页面结构

- `AppShell`：自有 Logo、半透明侧栏、顶部工具栏、窗口框架、折叠导航、全局搜索快捷键 `Ctrl/Cmd + K`。
- `SkillCatalog`：Skill 搜索、组合筛选、卡片/列表、来源、平台、脚本、冲突和纳管状态。
- `SourceConfidence`：显示来源结论、百分比、已确认/推断/未知、依据与“不是安全评分”说明。
- `ModelAttribution`：统一显示 Provider、实际模型 ID、职责、生成时间、最新/过期/失败/禁用状态。
- Pro 展示组件：`ProLogo`、`PageHeader`、`MetricCard`、`StatusBadge`。
- 七个详情标签页：概览、`SKILL.md`、文件、来源、安装位置、版本、操作记录。
- 高风险确认：回收站永久删除采用“影响范围确认 -> 输入精确名称”的两步 UI。
- 自有品牌：新增正式 mark/wordmark，移除 Wave 0 占位资产，并由同一 SVG 重新生成 Windows、macOS、Linux、iOS 和 Android 图标。

## 4. 设计 Token

主要语义 Token 位于 `src/styles/tokens.css`：

| Token | 用途 |
|---|---|
| `--pro-bg-deep`、`--pro-bg-mid` | 深海蓝背景层 |
| `--pro-surface-glass`、`--pro-surface-glass-strong` | 半透明表面 |
| `--pro-surface-elevated` | 高层弹窗和浮层 |
| `--pro-border-soft`、`--pro-border-strong` | 细边框层次 |
| `--pro-highlight` | 顶部柔和高光 |
| `--pro-text-primary/secondary/muted` | 三级文本 |
| `--pro-accent`、`--pro-accent-strong` | 青蓝品牌强调 |
| `--pro-success/warning/danger/info` | 海绿、琥珀、珊瑚红与信息状态 |
| `--pro-blur-strength` | 玻璃模糊强度 |
| `--pro-radius-sm/md/lg/xl` | 控件到窗口圆角 |
| `--pro-shadow`、`--pro-shadow-soft` | 海底层次阴影 |
| `--pro-transition` | 160ms 克制动效 |

`src/styles/pro-theme.css` 提供玻璃面板、页面头、按钮、指标和状态的共享视觉语言。保留上游 Token 兼容别名，避免重写其他 feature。透明度关闭时使用不透明深海蓝表面；系统或用户减少动态效果时禁用动画和位移。

## 5. Mock 数据和接口

统一 Mock 类型位于 `src/shared/mock/proMockData.ts`：

- `MockSkill`
- `SourceConfidenceData`
- `ModelAttributionData`
- `MockPlatform`
- `MockActivity`
- `MockTrashEntry`
- `MockProviderConfig`

类型化 Mock API：

| 文件 | 接口 |
|---|---|
| `features/discover/api/mockInstallApi.ts` | `createMockInstallPlan` |
| `features/trash/api/mockTrashApi.ts` | `restoreMockTrashEntry`、`purgeMockTrashEntry` |
| `features/ai-settings/api/mockAiSettingsApi.ts` | `testMockProvider`、`saveMockProvider` |

以上接口不读取文件、不写数据库、不发网络请求，也不调用 MiniMax/OpenAI。设置页的减少动态和降低透明度只写入 `skill-studio-pro.*` 前缀的浏览器本地偏好。

## 6. 测试结果

本地环境：Windows，Node 24.15.0，npm 11.12.1，TypeScript 5.6.3。

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | 通过 |
| `npm run test` | 43 files；245 passed，2 skipped，0 failed |
| `npm run build` | 通过；Vite 6.4.3，2297 modules transformed |
| `git diff --check` | 通过 |

新增 18 个测试状态，覆盖：导航与旧路由重定向、团队入口隐藏、全局搜索快捷键、Skill 组合筛选、来源可信度、ModelAttribution、五类状态视觉、辅助功能偏好、Mock Provider 连接和永久删除二次确认。

完整测试最初并发运行时，上游 `TeamsPage` 的一个 10 秒用例出现资源竞争超时；单独复验通过。Vitest worker 上限随后固定为 2，完整 `npm run test` 全绿。测试输出仍包含上游已知的 jsdom `getComputedStyle(... pseudo-elements)` 提示，不影响结果。

浏览器视觉验收按浏览器控制技能尝试访问 `http://127.0.0.1:1420/`，但企业网络策略阻止 in-app Browser 访问本机地址。未绕过策略；因此没有生成浏览器截图。响应式断点、DOM 状态和构建产物已经验证，真实 WebView 像素验收仍列入下方已知问题。

## 7. 尚未接入的后端接口

以下页面均已预留交互，但目前仍使用 Mock 或静态状态：

- `inventory_root_list/upsert`、`inventory_scan_start/cancel`、`inventory_instance_list/get`
- `origin_resolution_get/confirm/recalculate`
- `library_skill_list/get`、纳管、快照、发布计划与映射移除
- `import_plan_create/execute` 以及本地、Git、ZIP 暂存流程
- `trash_plan_create`、移动、恢复与永久删除执行
- `operation_list` 与事件增量更新
- `ai_provider_list/save/test`、任务路由、AI 产物生成
- OS Secret Store、凭据引用、真实 API 错误分类

全局搜索、通知、平台配置、扫描按钮、中央库发布和来源纠正目前为展示入口。接入后端时应替换 Mock API 实现，不需要重写页面结构或语义组件。

## 8. 已知视觉和跨平台问题

1. 900×600、1280×800 与窄窗口断点已在 CSS 中实现；因本机浏览器访问策略限制，尚未完成真实 WebView 截图对比。发布前应在 Tauri WebView2、WKWebView 和 WebKitGTK 各做一次 E2E-008 像素验收。
2. `backdrop-filter`、`color-mix()` 与字体抗锯齿在 WebView2、WKWebView、WebKitGTK 会有轻微差异；降低透明度模式提供不透明降级，但仍需 Linux GPU/软件渲染检查。
3. 新桌面图标已从正式 Pro mark 生成，并人工检查 512px PNG；尚未执行三平台安装包与系统 Dock/任务栏 smoke。
4. Pro 页面内容当前以简体中文为主；导航有中英文 key，设置中的语言切换暂未覆盖全部新增页面文案。
5. Mock 数据中的 Windows 路径仅用于展示。真实路径必须由后端按操作系统返回，前端不得推导路径分隔符。
6. 全局搜索在本 Wave 只提供视觉与键盘入口，尚未绑定索引查询。
7. 高 DPI 使用矢量品牌资产、响应式尺寸和 Tauri 多尺寸图标；仍需在 Windows 150%/200% 与 macOS Retina 上做人工清晰度检查。

## 9. 公共类型与并行模块边界

- 未修改 Rust 扫描、数据库、迁移或 Tauri command。
- 未修改后端公共领域类型；所有新增类型均位于前端 Mock 模块。
- 未删除团队、项目、市场等上游 feature，只从第一代路由和导航隐藏。
- `src-tauri/icons/**` 的修改仅为品牌图标的机械再生成，不涉及 Rust 代码或后端行为。
