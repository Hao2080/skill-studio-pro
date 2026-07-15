# Skill Studio Pro V1 闭环执行计划

状态：Active

日期：2026-07-16

基线：`wave-0-baseline`，实现审计起点 `d626224`

依赖文档：

- [SPEC.md](./SPEC.md)
- [PRD.md](./PRD.md)
- [TECHNICAL-DESIGN.md](./TECHNICAL-DESIGN.md)
- [AUTOMATED-TESTING.md](./AUTOMATED-TESTING.md)
- [TEST-VALIDATION.md](./handoffs/TEST-VALIDATION.md)

## 1. 总体策略

后续工作使用 4 个新的 Codex 任务，严格按依赖顺序执行。每个任务直接读取仓库和前一个任务的交接文件，不要求用户在窗口之间复制结果。

所有任务默认在同一项目的本地工作区串行运行。前一个任务必须满足以下条件，后一个任务才可启动：

1. 任务状态已完成，最终回复以 `HANDOFF_READY` 开头。
2. 工作区干净，全部有效修改已经提交。
3. 规定的 `docs/handoffs/` 文件存在并记录提交、测试和限制。
4. `npm run check` 与该阶段专项测试通过。
5. 不存在未说明的真实用户数据、API Key、数据库、日志、回收站或构建产物提交。

总控任务每 10 分钟检查一次任务状态、Git、交接和测试事实；发现缺陷时直接向当前任务发送补做指令，或创建单独修复任务。只要发布阻断项仍存在，就不报告全部完成。

## 2. Task 1：V1 产品闭环

目标：把已经存在的后端能力接成用户可以真实完成的产品流程。

范围：

- 中央 Skill 编辑工作区
- AI 简介/用法生成、取消与重新生成
- 平台中心真实检测与配置
- 扫描根管理
- 对应组件、IPC 契约和跨层测试

交付：

- 生产页面不再用静态平台数据或仅展示缓存冒充完成。
- 编辑、AI、平台、扫描根四类闭环满足 Draft 0.2。
- `docs/handoffs/V1-PRODUCT-CLOSURE.md`
- 全量 `npm run check` 通过。

不得在该任务中创建公开 Release，也不得使用真实用户 Agent 目录或真实付费模型做自动化测试。

## 3. Task 2：Windows 真实桌面验收

依赖：Task 1 `HANDOFF_READY`。

目标：使用 release 应用和隔离目录验证真实 WebView 用户流程，并修复发现的问题。

范围：

- 构建 Windows NSIS 和 release EXE
- 隔离 Home/config/workspace/五 Agent 目录
- 扫描、纳管、编辑、AI、发布、漂移、回收、恢复
- 900×600、1280×800、高 DPI、键盘、减少动态和降低透明度
- 1,000 Skill/100,000 文件发布候选基准
- 真实 MiniMax/OpenAI 仅在安全凭据可用且明确授权时做最小连接/生成验收

缺陷处理：先写可重复测试或脚本，再做最小修复，随后重跑目标测试、`npm run check`、NSIS 和受影响桌面流程。

交付：

- `docs/handoffs/WINDOWS-UAT.md`
- 验收证据、性能数据、安装包路径、已修复缺陷和剩余真实平台边界
- 工作区干净且全部门槛通过

## 4. Task 3：开源与三平台 Public Beta

依赖：Task 2 `HANDOFF_READY`。

目标：完成公开仓库、三平台真实 CI 和 `v0.1.0-beta.1` 发布准备或发布。

范围：

- Pro 独立公开 GitHub `origin` 与默认 `main`
- Windows、macOS、Linux 真实 CI
- 三平台安装包构建与启动 smoke
- Windows Credential Manager、macOS Keychain、Linux Secret Service 契约
- SBOM、第三方依赖/资产清单
- `SECURITY.md`、`CONTRIBUTING.md`、构建、安装、数据目录和 API 配置文档
- SHA-256、变更说明和已知限制
- Pro 自有 Release；自动更新继续保持关闭，除非 Pro 签名端点已经独立建立

外部状态规则：

- 若本机只有一个明确已登录且有权限的 GitHub 身份，可在用户已经要求“产品开源并完成后续工作”的范围内创建 `skill-studio-pro` 公开仓库。
- 若存在多个身份、目标组织不明确、无权限或需要额外付费签名服务，不得猜测所有权；先完成所有本地发布准备，并由总控任务向用户请求最小必要选择。
- GitHub Actions 失败必须读取日志、修复并重跑，不能只记录“CI 待验证”。

交付：

- `docs/handoffs/PUBLIC-BETA.md`
- 公开仓库/PR/Actions/Release 可追溯链接或精确外部阻断
- 三平台结果和产物清单

## 5. Task 4：独立最终审计

依赖：Task 3 `HANDOFF_READY`，或所有可在现有权限内完成的发布准备已经完成并准确记录外部阻断。

目标：独立判断产品是否满足 Draft 0.2 和首个 Public Beta 门槛。

审计：

- 逐项读取 SPEC、PRD 和测试追踪矩阵
- 复查编辑、AI、平台、扫描根和完整生命周期
- 复查 Windows/macOS/Linux 真实结果
- 复查性能、秘密、许可证、SBOM、上游归属和产物内容
- 复查公开仓库、版本、tag、Release 和已知限制一致性

发现问题时必须修复、补测试并重新执行受影响门槛；必要时退回前一任务。不得通过降低 SPEC、安全要求或将失败改成 skip 来获得通过。

交付：

- `docs/handoffs/FINAL-RELEASE-AUDIT.md`
- 明确结论：`PASS`、`PASS WITH EXTERNAL BLOCKER` 或 `FAIL`
- 只有 `PASS` 才表示 Skill Studio Pro V1 Public Beta 全部完成

## 6. 总控完成条件

全部工作完成必须同时满足：

1. 4 个任务均有可读交接和提交。
2. 编辑、AI、平台、扫描根不再是后端孤岛或静态 UI。
3. Windows 真实全生命周期和性能门槛通过。
4. Windows、macOS、Linux 真实 CI、构建和启动结果通过。
5. 公开仓库、许可证、SBOM、安全文档和 Beta 产物完整。
6. 最终独立审计为 `PASS`。

