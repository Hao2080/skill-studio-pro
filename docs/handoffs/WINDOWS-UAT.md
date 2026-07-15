# Skill Studio Pro Draft 0.2 — Windows 真实桌面验收

日期：2026-07-16（Asia/Shanghai）

分支：`wave-0-baseline`

任务：V1 Task 2，仅 Windows release/NSIS、真实 Tauri WebView 验收、缺陷闭环和 Gate C/D 的本机部分；没有创建公开仓库或 GitHub Release。

提交基线与本任务提交：

- Task 1 实现：`483c47588fe33d0c1243feddb848a317e51e8890`
- Task 1 交接 / Task 2 起始 HEAD：`e9f842bd9da2285aa5e099c5950b36ae63638993`
- Task 2 缺陷修复、回归测试与 UAT 驱动：`a2eff671c5d8b5fa22699cdbca29d8c45798c639`
- Task 2 交接：本文件所在的最终交接提交；精确提交由最终任务消息锁定，避免文档自引用哈希。

开始时已核对分支、HEAD 和 `git status --short`：工作区干净，没有发现其他任务的未提交修改。

## 1. 结论

Windows Gate C 通过。不是 Vite/browser preview，也不是浏览器 Mock 验收：release EXE 与 NSIS 均实际构建，NSIS 从全新隔离目录静默安装，安装后的 `skill-studio-pro.exe` 实际启动；Windows UI Automation 直接操作 `WRY_WEBVIEW` / `RootWebArea` 中的真实 Tauri WebView，完成扫描、纳管、查看原文、编辑、AI Mock、五 Agent 发布、漂移治理、回收站与恢复。

本任务发现 12 组可复现缺陷，均先增加回归测试或真实桌面复现证据，再做最小修复并重跑受影响桌面流程。最终 TypeScript 60 个测试文件、290 tests 通过；Rust 默认套件 111 tests 通过，发布候选性能基准另以 release + `--ignored` 实际执行并通过。

真实 MiniMax/OpenAI 标记为 `NOT_RUN`：本机没有在“不读取、显示、复制或日志化用户密钥”的前提下可明确确认的安全测试凭据。没有询问用户索取密钥，没有读取 Credential Manager，也没有调用真实计费端点；这不阻断 Gate C。MiniMax/OpenAI 自动化全部使用隔离 loopback Mock Provider。

状态定义：

- `AUTOMATED`：脚本或 Windows UI Automation 实际驱动 release 桌面进程并保存结构化结果。
- `MANUAL_OBSERVED`：对真实桌面截图进行人工视觉检查；不把截图观察伪装成自动断言。
- `NOT_RUN`：没有安全条件或超出本 Windows Task 2 范围，明确不声称通过。

## 2. 隔离环境与数据边界

专用临时根：

`<Task2-UAT-root>`

该根的布局记录在 `uat-layout.json`；证据位于 `evidence\`，截图位于 `screenshots\`。隔离启动注入并单独创建：

- `HOME`、`USERPROFILE`
- `APPDATA`、`LOCALAPPDATA`、`TEMP`、`TMP`、`XDG_CONFIG_HOME`
- `SKILL_STUDIO_PRO_HOME`、`SKILL_STUDIO_PRO_CONFIG_HOME`、`SKILL_STUDIO_PRO_WORKSPACE`
- `WEBVIEW2_USER_DATA_FOLDER`
- Codex、Claude Code、Cursor、Windsurf、Gemini CLI 的独立目录
- 应用配置、workspace、SQLite 数据库、回收站、日志、性能数据和 Mock Provider 日志

夹具由 `scripts/windows-uat/prepare-isolated-uat.ps1` 生成，覆盖 SKILL.md、YAML、JSON、TOML、纯文本、二进制、坏 YAML、同名 Skill、Git/插件已知来源、推断来源、自定义扫描根、漂移、五平台映射和回收站。首轮扫描前后共比较 13 个外部夹具文件的 SHA-256 与 mtime；最终复核仍为 13/13 不变，见 `evidence\first-scan-zero-write-result.json` 和 `evidence\54-external-fixtures-unchanged-after-final-scans.json`。

没有读取或写入用户真实 Skill、Agent 目录、用户数据库、Credential Manager 或 API Key。Mock 使用的临时虚构 key 只进入隔离进程；停止进程后对整个任务根进行文字扫描，0 命中，见 `evidence\59-fictional-credential-persistence-check.json`。Mock 日志只记录 method、path、bytes、schema 与 `authPresent`，不记录 Authorization 或请求正文。

没有执行递归自动清理，证据根保留给后续审计。结束时只停止了经 PID、命令行/可执行文件路径和任务根共同核验的桌面与 Mock 进程，见 `evidence\58-test-processes-stopped.json`、`evidence\64-final3-process-stopped.json`。所有 UAT 脚本都拒绝作用于名称不符合 `Skill-Studio-Pro-Task2-UAT-*` 的根。

## 3. 机器与最终发布产物

机器记录：Windows 11 Pro `10.0.26200` x64；Intel Core i5-13400F，10 核 / 16 线程；68,521,381,888 bytes 可见内存；Node `24.15.0`、npm `11.12.1`、rustc/cargo `1.96.0`、PowerShell `7.6.3`、WebView2 `150.0.4078.65`。显示器物理分辨率 2160×3840，实际窗口 DPI 144（150%）。完整记录见 `evidence\60-machine.json` 和 `evidence\50-display-dpi.json`。

最终构建命令：

```powershell
npm run tauri build -- --bundles nsis
```

构建日志：`evidence\62-build-nsis-final3.log`；产物记录：`evidence\62-release-artifacts-final3.json`。

| 产物 | 路径 | 长度 | SHA-256 |
|---|---|---:|---|
| release EXE | `src-tauri/target/release/skill-studio-pro.exe` | 23,216,128 | `87BBEE637A8A00994F80BAC61C7263790EB74CB1BF554EB6DA8F64280FAFC78B` |
| Windows NSIS | `src-tauri/target/release/bundle/nsis/Skill Studio Pro_0.1.0_x64-setup.exe` | 5,995,052 | `4436BF3A58305111710E5452E081A87D8B8238E2C719A843930817EAA2141DC4` |
| 最终全新安装 EXE | `<Task2-UAT-root>/install-final3/SkillStudioPro/skill-studio-pro.exe` | 23,216,128 | `6AB05E6CF9479F8E0D24D1E86A9930A49F82DE4AF7FE1550B13F3E8DAC8C8E49` |

最终 NSIS `/S` 返回 0，安装目录此前不存在；安装 EXE 产生真实主窗口，WebView UIA 树可见“总览”，见 `evidence\63-install-launch-final3.json`、`evidence\63-final3-dashboard-visible.json`、`evidence\uia-tree-final3-startup.json`。

安装 EXE 与构建 EXE 的哈希不同是 Tauri/NSIS 的预期 bundle 标记：逐字节比较只有 offset 17,625,136～17,625,138 三个字节不同，`__TAURI_BUNDLE_TYPE_VAR_UNK` 在安装副本中变为 `..._NSS`；其余 23,216,125 字节一致。见 `evidence\63-installed-exe-hash-final3.json`。

## 4. 真实 WebView 流程矩阵

| 流程 | 状态 | 实际结果与主要证据 |
|---|---|---|
| 全新安装与启动 | AUTOMATED | NSIS exit 0；release 安装进程保持运行；`RootWebArea` 加载总览。最终证据见第 3 节。 |
| 首次扫描零写入 | AUTOMATED | 扫描前后 13 个来源文件 hash + mtime 不变；最终全流程后仍不变。 |
| 扫描根选定/全量 | AUTOMATED | 添加、编辑、停用、重新启用、选定扫描和强制全量扫描均从真实 UI 触发；选定扫描显示 `completed 1/1`。见 `07-*`、`27-*`、`54-final2-*`。 |
| 本机目录与详情 | AUTOMATED | 真实索引加载；检查 SKILL.md 原文、来源依据、已知/推断来源、同名冲突、坏格式和多文件；外部实例为只读。见 `08-*`～`11-*`。 |
| 纳入中央库 | AUTOMATED | 先展示目标/影响计划，再复制到中央主副本；外部原目录保持不变。见 `12-register-*`。 |
| 编辑闭环 E2E-009 | AUTOMATED | Markdown、JSON、TOML 和纯文本进入编辑器；二进制只读；dirty guard 取消后草稿保留；坏 JSON 保存明确失败且输入保留；成功保存显示恢复点、before/after hash，并把 5 个 mappings 标记 outdated。见 `14-*`～`16-*`、`21-fixed4-*`、`28-fixed4-*`、`34-finalrc-*`。 |
| AI 无凭据边界 | AUTOMATED | Provider 未配置/无临时凭据时先于网络访问明确报错，不影响本地功能。见 `29-*`～`31-*`。 |
| AI Mock E2E-010 | AUTOMATED | loopback MiniMax/OpenAI 连接测试；生成、延迟取消、成功、缓存、stale、force 重生成均从桌面触发。缓存前后请求数 16→16；stale 重生成新增 4 个任务请求。见 `32-*`、`33-*`、`35-*`、`42-*`、`43-*`。 |
| 五 Agent copy 发布 | AUTOMATED | Codex、Claude Code、Cursor、Windsurf、Gemini CLI 五个隔离目标均实际创建受管目录。见 `36-publish-five-targets.json`。 |
| Windows symlink | AUTOMATED | 请求 `symlink` 后明确失败：Win32 privilege error 1314；没有静默 copy，既有 copy 在失败回滚后保持。见 `38-symlink-windows-result.json`。 |
| drift 与治理确认 | AUTOMATED | 人工改写隔离 Cursor 目标后，`abort` 计划阻断执行；切换 `overwrite` 后出现覆盖确认，再发布移除漂移 marker 并恢复目标 hash。见 `39-*`、`44-final-*`。 |
| 删除与恢复 | AUTOMATED | 删除计划列出中央文件、hash 和 5 个映射；确认后中央主副本进入应用回收站，五目标移除；恢复后中央文件回原位，映射不被意外重发。见 `46-final2-*`、`47-final2-*`。 |
| 平台中心 E2E-011 | AUTOMATED | 五平台真实检测、隔离路径设置/测试/保存、启停和治理影响、自定义平台创建/路径测试/删除均完成；删除/停用配置后外部目录仍存在。见 `20-*`～`27-*`。 |
| 真正 MiniMax/OpenAI | NOT_RUN | 没有安全确认的本机测试凭据；没有访问用户 Credential Manager 或真实端点。 |

真实桌面控制方式是 `scripts/windows-uat/desktop-uia.ps1`，不是 browser preview。WebView2 的 CDP 端口在本机没有开放，因此没有把 CDP 当证据；现有 Windows UI Automation 能读取真实可访问性树、Invoke/Value/Toggle pattern、窗口尺寸、焦点和截图，关键流程均已覆盖。

## 5. 尺寸、DPI、键盘与效果降级

| 检查 | 状态 | 结果 / 截图 |
|---|---|---|
| 900×600 logical @ 150% | AUTOMATED + MANUAL_OBSERVED | 物理窗口 1350×900；回收站、详情、平台中心均可滚动到达关键操作，无关键遮挡。`31-final-900x600-trash.png`、`33-final-900x600-detail.png`、`36-final-900x600-platforms-reduced.png`。 |
| 1280×800 logical @ 150% | AUTOMATED + MANUAL_OBSERVED | 物理窗口 1920×1200；详情布局完整，无横向溢出。`34-final-1280x800-detail.png`。 |
| 高 DPI | AUTOMATED | `GetDpiForWindow` = 144，scale = 1.5。`evidence\50-display-dpi.json`。 |
| 键盘与焦点 | AUTOMATED + MANUAL_OBSERVED | UIA focus + Enter 从导航进入列表/详情；`:focus-visible` 青色轮廓可见。`32-final-keyboard-focus-900x600.png`、`49-keyboard-*`。 |
| 减少动态/降低透明度 | AUTOMATED + MANUAL_OBSERVED | 两项真实设置均切换到“已启用”；玻璃透明/动画降级后页面操作仍可达。`35-final-reduced-motion-transparency.png`、`evidence\51-reduced-settings-result.json`。 |

截图均按应用窗口或应用元素裁剪；没有保留包含其他桌面内容的全屏截图。

## 6. 1,000 Skill / 100,000 文件发布候选基准

执行命令：

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --release --test inventory_performance -- --ignored --nocapture
```

该基准不是默认 ignored 的“存在性”声明：本任务实际执行两次 release benchmark。第一次结果在 `evidence\55-inventory-benchmark-result.json`，第二次用受保护的 `SKILL_STUDIO_PRO_BENCHMARK_RETAIN_ROOT` 保留同一数据集供真实桌面 UI 加载，见 `evidence\56-retained-inventory-benchmark-result.json` 和 `56-retained-inventory-benchmark.log`。

| 指标 | 第一次 | 保留数据集复跑 | 结论 |
|---|---:|---:|---|
| 数据集 | 1,000 / 100,000 | 1,000 / 100,000 | 满足固定规模 |
| 全量扫描 | 129,298 ms | 129,332 ms | 已记录；测试计划未为全量扫描规定绝对阈值 |
| 增量扫描 | 55,364 ms | 32,502 ms | 已记录 |
| 搜索 P95 | 0 ms | 1 ms | PASS，< 150 ms |
| 单 Skill 详情 P95 | 0 ms | 0 ms | PASS，< 300 ms |
| 第一次 runner 总耗时 | 393,943 ms | 299,492 ms | 含 release 构建/测试调度，不等同纯扫描 |
| 第一次观测峰值工作集 | 227,995,648 bytes | 未重复采样 | runner 及最多 4 个相关进程的合计观测口径 |

保留数据集由同一最终产品代码的 release 安装 EXE 加载。真实 900×600 WebView 显示 `1000 个实例`，进程保持 Responding；Dashboard/列表/搜索/详情工作集分别约 33.5/未单独记录/34.7/35.1 MB。真实 UI 搜索 `Skill 0500` 只剩 1 张卡，UIA 端到端调用 1,177 ms；打开详情 854 ms并显示 100 个文件。UIA 数值包含启动 PowerShell/UIA harness 的开销，不与后端 P95 阈值混用。见 `evidence\57-performance-*.json` 与 `screenshots\37-*`～`40-*`。

原生主窗口 handle 在启动后 212 ms 出现；完整缓存索引首屏的精确 paint/hydration 时间没有浏览器埋点，因此不把 212 ms 冒充“首屏 ≤5 秒”断言。实际总览 1,000 实例、搜索、列表和详情均可操作，UI 可用性结论为 PASS；精确 first-content threshold 为 `NOT_RUN`。

## 7. 发现并修复的缺陷

| 缺陷 | 最小修复 | 回归/桌面复核 |
|---|---|---|
| “管理扫描根”按钮无动作 | 连接到 `/platforms` | `ProRuntimeIntegration.test.tsx` + 真实点击 |
| 平台检测绕过隔离 Home，暴露真实用户路径 | 平台 store 统一使用 `workspace::home_dir()` | `DesktopWindowContract.test.ts`；隔离树中真实 Home 命中 0 |
| 显式 workspace override 被持久化 bootstrap 覆盖 | 环境 override 优先 | Rust workspace test + final fresh install |
| 快速扫描完成事件早于 startScan 返回，UI 永久停在 running | 订阅真实 scan progress，缓存早到事件并刷新 terminal 状态 | `ScanRootsPanel.test.tsx` + 实际 selected/full scan |
| 原生 `window.confirm` 在 WebView 中取消后路由仍改变 | 改为 AntD 应用内 modal，只有 `onOk` 执行事务 | editor/AppShell/详情测试 + `21-fixed4-dirty-guard-modal.png` |
| 保存后完整 loading 卸载编辑器，恢复点/hash 结果不可见 | 后台刷新而不卸载 | `SkillDetailProPage.test.tsx` + finalrc 保存证据 |
| 已有 AI 产物只能 force，无法验证缓存 | 增加“刷新（优先缓存）” | `AiArtifactPanel.test.tsx`；请求 16→16 |
| 发布 UI 硬编码 copy，symlink 能力不可达 | 增加同步模式与明确“不静默降级”提示 | 详情测试 + Win32 1314 真实结果 |
| 中央详情无回收站入口 | 增加删除影响计划、确认与跳转 | 详情测试 + 五映射 trash/restore |
| drift UI 只支持 abort，overwrite 后端不可达 | 增加 drift policy 与二次覆盖确认 | 详情测试 + Cursor 真实 drift/overwrite |
| 中央编辑没有把 AI artifact 标 stale | 保存/更新事务标记未过期 artifact | Rust lifecycle regression + 真实 stale/re-generate |
| trash 已发布 Skill 时重复获取 skill lock；Windows 子操作名还含非法字符 | mapping service 增加受父 skill lock 的 remove 路径，并清理子操作名 | `trash_with_managed_mapping_releases_mapping_without_reacquiring_skill_lock` + 五映射真实删除/恢复 |

## 8. 最终质量门

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | PASS，exit 0 |
| `npm run test` | PASS，60 files / 290 tests，0 failed |
| `npm run build` | PASS，exit 0 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS，exit 0 |
| `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` | PASS，exit 0 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS，111 tests，0 failed；性能 test 在默认套件中 1 ignored，但已按第 6 节 release 实跑通过 |
| `npm run check` | PASS，exit 0；再次包含 typecheck/test/build/fmt/check/clippy/test/security |
| `npm run security:repo` | PASS，560 tracked 或 unignored 候选文件（包含本交接文档） |
| Windows UAT scripts PowerShell parser + `node --check` | PASS |
| `git diff --check` | PASS；最终交接提交后再次执行 |
| Windows release EXE / NSIS 重建、全新安装和隔离启动 | PASS，见第 3 节 |

没有删除、skip 或降级既有测试。新增性能保留开关默认关闭，只允许目标精确位于 Task 2 专用根内的 `performance-retained`，不改变常规 test 的自动清理行为。

## 9. 已知边界

- `NOT_RUN`：真实 MiniMax/OpenAI，原因见第 1、4 节；不阻断 Gate C。
- Windows 当前权限不能创建 symlink，产品明确返回 error 1314 且没有 copy 降级；若在具备 Developer Mode/SeCreateSymbolicLinkPrivilege 的环境，应再执行成功分支。
- 一次长时间 UAT 会话中平台中心曾停留在 `loading/刷新检测`；使用同一最终安装和隔离数据重启后 3 秒内加载，后续未稳定复现。保留 `uia-tree-platforms-loading-long.json` 与 `53-final2-platform-relaunch-loaded.json`，不宣称已定位为产品缺陷。
- 1000 项列表当前能响应且内存稳定，但本轮没有为 UIA harness 时延设产品门槛；性能阈值只使用服务层 P95，见第 6 节。
- macOS/Linux 安装、Secret Store 和 symlink 不属于本 Windows Task 2，均未执行；不得从本报告推断三平台 Gate D 已完成。
- 没有创建公开仓库、tag、签名或 Release；Task 3/4 仍按 V1 串行门槛执行。
