# Skill Studio Pro v0.1.0-beta.1 Public Beta 交接

日期：2026-07-16（Asia/Shanghai）

任务：Draft 0.2 Task 3；独立公开仓库、三平台真实 CI、SBOM/许可证供应链、公开 prerelease。Task 4 的 `FINAL-RELEASE-AUDIT.md` 不在本任务范围内。

## 1. 结论

Skill Studio Pro 已作为独立 Apache-2.0 开源产品准备并发布到 [Hao2080/skill-studio-pro](https://github.com/Hao2080/skill-studio-pro)。默认分支为 `main`；`origin` 指向 Pro 仓库，`upstream` 保留指向 `liu673/skill-studio`，没有把上游仓库作为 Pro origin。

发布源码 tag `v0.1.0-beta.1` 固定指向 `eb8eb12bb3a22ee852f461eebe7c6a11c7a4ba9b`。该 tag 在同一提交的主 CI 与手动 release workflow 全绿后一次性创建并推送，没有移动或覆盖。

公开 prerelease：[Skill Studio Pro v0.1.0-beta.1](https://github.com/Hao2080/skill-studio-pro/releases/tag/v0.1.0-beta.1)，`draft=false`、`prerelease=true`，发布时间 `2026-07-16T02:33:37Z`。Release 包含 30 个公开资产，GitHub API 复核均为 `uploaded` 且长度大于 0。

## 2. Git 与公开仓库

| 项目 | 结果 |
|---|---|
| Task 3 起始分支 / HEAD | `wave-0-baseline` / `fb3e018f0e8deb119439f82c6abe0f20bea0b19c` |
| Task 2 实现 | `a2eff671c5d8b5fa22699cdbca29d8c45798c639` |
| Task 3 初始开源/发布实现 | `a916dbd` |
| tag 源码提交 | `eb8eb12bb3a22ee852f461eebe7c6a11c7a4ba9b` |
| 当前交接提交 | 本文件所在的最终交接提交；精确 HEAD 由最终交接消息锁定，避免文档自引用哈希 |
| 公开仓库 | <https://github.com/Hao2080/skill-studio-pro> |
| 可见性 / 默认分支 | `PUBLIC` / `main` |
| `origin` | `https://github.com/Hao2080/skill-studio-pro.git` |
| `upstream` | `https://github.com/liu673/skill-studio.git` |
| tag | <https://github.com/Hao2080/skill-studio-pro/tree/v0.1.0-beta.1> |

仓库 metadata、homepage、topics、issue templates、PR template、Dependabot、SECURITY、CONTRIBUTING、CODE_OF_CONDUCT、CHANGELOG、release notes 与公开 README 均已改为 Pro 自有定位。README 包含真实隔离 Windows UAT 产品截图；上游历史截图仅作为归属明确的 branding reference 保留。当前跟踪树没有真实 UAT 根、本机绝对路径、用户数据库、凭据、日志、构建缓存或带隐私的截图。

Apache-2.0 `LICENSE` 保留；`NOTICE` 明确上游来源、Pro 修改和第三方资产归属，没有删除必要归属。自动更新保持关闭。

## 3. 同一 HEAD 主 CI

主 CI：[run 29463338382](https://github.com/Hao2080/skill-studio-pro/actions/runs/29463338382)，事件 `push`，HEAD `eb8eb12bb3a22ee852f461eebe7c6a11c7a4ba9b`，结论 `success`。

| 必需 job | URL | 结论 |
|---|---|---|
| Windows quality/package/smoke | [job 87511219722](https://github.com/Hao2080/skill-studio-pro/actions/runs/29463338382/job/87511219722) | `success` |
| macOS quality/package/smoke | [job 87511219727](https://github.com/Hao2080/skill-studio-pro/actions/runs/29463338382/job/87511219727) | `success` |
| Supply chain | [job 87511219736](https://github.com/Hao2080/skill-studio-pro/actions/runs/29463338382/job/87511219736) | `success` |
| Linux quality/package/smoke | [job 87511219770](https://github.com/Hao2080/skill-studio-pro/actions/runs/29463338382/job/87511219770) | `success` |
| Security audit | [job 87511597068](https://github.com/Hao2080/skill-studio-pro/runs/87511597068) | `success` |

该 run 在真实 `windows-latest`、`macos-latest`、`ubuntu-latest` GitHub-hosted runners 上执行前端 typecheck/test/build、Rust fmt/check/all-targets clippy/test、仓库卫生、原生 Secret Store 合约、Tauri 打包、安装后启动 smoke、hash 与证据上传。

发布空资产修复提交 `8630d7c69635188313f3c1e2f1e7929c15ac637f` 的主 CI 为 [run 29466250752](https://github.com/Hao2080/skill-studio-pro/actions/runs/29466250752)，五个必需 job 同样全部 `success`：Linux [87519912235](https://github.com/Hao2080/skill-studio-pro/actions/runs/29466250752/job/87519912235)、Windows [87519912238](https://github.com/Hao2080/skill-studio-pro/actions/runs/29466250752/job/87519912238)、供应链 [87519912250](https://github.com/Hao2080/skill-studio-pro/actions/runs/29466250752/job/87519912250)、macOS [87519912254](https://github.com/Hao2080/skill-studio-pro/actions/runs/29466250752/job/87519912254)、Security audit [87520265752](https://github.com/Hao2080/skill-studio-pro/runs/87520265752)。

## 4. release workflow

### 无 tag 完整演练

[run 29464344223](https://github.com/Hao2080/skill-studio-pro/actions/runs/29464344223)，事件 `workflow_dispatch`，HEAD `eb8eb12bb3a22ee852f461eebe7c6a11c7a4ba9b`，结论 `success`。该 run 真实重跑全部门槛与三平台构建，下载并校验平台 manifests，再生成 aggregate；因事件不是 tag push，没有创建 Release。

| job | URL | 结论 |
|---|---|---|
| Verify release supply chain | [job 87514215892](https://github.com/Hao2080/skill-studio-pro/actions/runs/29464344223/job/87514215892) | `success` |
| Linux release | [job 87514673456](https://github.com/Hao2080/skill-studio-pro/actions/runs/29464344223/job/87514673456) | `success` |
| macOS release | [job 87514673462](https://github.com/Hao2080/skill-studio-pro/actions/runs/29464344223/job/87514673462) | `success` |
| Windows release | [job 87514673463](https://github.com/Hao2080/skill-studio-pro/actions/runs/29464344223/job/87514673463) | `success` |
| Aggregate/hash verification | [job 87516936389](https://github.com/Hao2080/skill-studio-pro/actions/runs/29464344223/job/87516936389) | `success` |

下载该 run 的 aggregate 后，已在本机重新计算 `SHA256SUMS.txt` 中全部 29 个文件的 SHA-256，29/29 一致。aggregate 共 30 个文件，额外一项是 `SHA256SUMS.txt` 本身。

### tag 发布 run

[run 29465288941](https://github.com/Hao2080/skill-studio-pro/actions/runs/29465288941)，事件 `push`，ref `v0.1.0-beta.1`，HEAD `eb8eb12bb3a22ee852f461eebe7c6a11c7a4ba9b`。

该 run 的供应链、Linux、Windows、macOS 四个必需 job 均为 `success`；最终 publish job 在所有 manifests/hash 已验证后失败，完整日志为 GitHub Upload API 对唯一的 0-byte `smoke-macos.log` 返回 `HTTP 400: Bad Content-Length`。失败时 `gh release view` 为 `release not found`，没有留下可见的部分 Release。

修复提交 `8630d7c69635188313f3c1e2f1e7929c15ac637f` 完成三项改进：macOS smoke 主动写入非空 PASS 摘要；聚合器在上传前拒绝任意 0-byte 资产；`workflow_dispatch` 可从既有 immutable tag 检出源码并恢复发布。tag 没有删除、覆盖或移动，annotated tag 对象 `58fa3270268f375af7bc6c4af18773ce3aec267c` 始终 peeled 到 `eb8eb12bb3a22ee852f461eebe7c6a11c7a4ba9b`。

恢复发布使用 [run 29466257022](https://github.com/Hao2080/skill-studio-pro/actions/runs/29466257022)，workflow 定义来自修复后的 main，但 supply/build/publish checkout 均显式使用 `v0.1.0-beta.1`；发布前 step 通过 `git ls-remote` 核对远端 annotated tag peeled commit 与 checkout HEAD 完全一致。五个 job 全部 `success`：

| job | URL | 结论 |
|---|---|---|
| Verify release supply chain | [job 87519929875](https://github.com/Hao2080/skill-studio-pro/actions/runs/29466257022/job/87519929875) | `success` |
| Linux release | [job 87520281719](https://github.com/Hao2080/skill-studio-pro/actions/runs/29466257022/job/87520281719) | `success` |
| Windows release | [job 87520281739](https://github.com/Hao2080/skill-studio-pro/actions/runs/29466257022/job/87520281739) | `success` |
| macOS release | [job 87520281757](https://github.com/Hao2080/skill-studio-pro/actions/runs/29466257022/job/87520281757) | `success` |
| Aggregate/hash/tag verification + prerelease | [job 87521735989](https://github.com/Hao2080/skill-studio-pro/actions/runs/29466257022/job/87521735989) | `success` |

## 5. 三平台安装包、启动与 Secret Store

所有 smoke 均从 CI 生成的安装包开始，不是只检查文件存在。环境变量把 HOME、配置、workspace、数据库和 WebView profile 指向 runner 临时隔离目录；没有使用用户真实 Skill、数据库或个人凭据。

| 平台 / runner | 安装产物 | 安装后启动 smoke | 原生 Secret Store |
|---|---|---|---|
| Windows / `windows-latest` | x64 NSIS `.exe` | `/S` 静默安装返回 0；启动安装目录中的 EXE；观察主窗口；保持运行至少 5 秒；30 秒内配置与 SQLite bootstrap 成立 | Windows Credential Manager，唯一虚构测试 secret，写/读/删契约通过 |
| macOS / `macos-latest` | arm64 `.dmg` | 挂载 DMG、复制 `.app`、直接启动 bundle executable；保持运行 10 秒；隔离 bootstrap 成立 | macOS Keychain，唯一虚构测试 secret，写/读/删契约通过 |
| Linux / `ubuntu-latest` | amd64 `.deb`、AppImage | `dpkg` 安装 deb；在隔离 `dbus-run-session + xvfb-run` 下前台启动；`timeout` 10 秒返回 124；配置与 SQLite bootstrap 成立 | 隔离 D-Bus + GNOME keyring Secret Service，唯一虚构测试 secret，写/读/删契约通过 |

主 CI 的下载证据显示三平台 `native_secret_store_contract` 均为 1 passed / 0 failed；Windows runner 的 bootstrap 实际在主窗口出现后 10.163 秒就绪，证明固定 5 秒检查会产生竞态，最终脚本采用最长 30 秒的有界就绪轮询，同时持续断言进程存活。

## 6. SBOM、许可证与安全扫描

供应链生成器只从锁文件读取确定性输入，`npm run supply-chain:check` 在不同 runner 上验证生成结果与跟踪文件逐字节一致。共记录 900 个前端与 Rust 依赖。

| 文件 | SHA-256 |
|---|---|
| `artifacts/sbom/frontend.cdx.json` | `8b8d1f11367dc1a76396dc431b6ee6285141dae3fecee4ad82ee41e88882d2d4` |
| `artifacts/sbom/rust.cdx.json` | `502fffeb27a48209eeb4c20c68742c593476f2c39fa97c71089477a285fdbc9c` |
| `artifacts/sbom/skill-studio-pro.cdx.json` | `75d7c264074ae410ce57fcd0ac7e1886c1bbc05f125bc21c3dcf25b100f03bba` |
| `artifacts/THIRD-PARTY-LICENSES.json` | `cbe4e86641a061736fd258e19bdf6867919c5beb2bb46099048f562c3adba028` |
| `docs/THIRD-PARTY-NOTICES.md` | `a506fb777e682a2b06b0fa8aca91b699721624a666fc5d5be0551ee721f3606f` |

license policy 结果为 0 blocked、0 unknown；MPL/LGPL/CC-BY 等需要审阅的许可证单列为 review，不猜测或静默归类。字体、图标、品牌和截图资产均进入第三方/资产声明。

CI 还验证 package-lock/Cargo.lock、版本与 repository link、npm high audit、RustSec、当前树 repository hygiene、Gitleaks 全历史 secret scan。`npm audit --audit-level=high --omit=dev` 为 0 vulnerabilities；RustSec 为 0 vulnerabilities。

RustSec 另报告 17 个 `unmaintained` 与 2 个 `unsound` informational，主要来自 Linux GTK3/Tauri 的旧传递依赖。它们不是已发现 vulnerability，也没有被隐藏；迁移到不依赖 GTK3 旧绑定的未来 Tauri/Linux 栈前，作为 Public Beta 已知供应链风险保留。

## 7. 本地发布门槛

在 Windows、依赖安全补丁与最终 smoke 修复后的源码上执行：

- `npm run check`：通过；60 个测试文件、290 个前端测试；生产 build；Rust fmt/check；all-targets clippy + `-D warnings`；111 个默认非 ignored Rust tests；repository hygiene。发布候选 1,000 Skill/100,000 文件 ignored benchmark 已由 Task 2 以 release + `--ignored` 实际执行通过。
- `npm run supply-chain:check`：通过；900 dependencies，SBOM/license hashes 如第 6 节。
- `npm audit --audit-level=high --omit=dev`：0 vulnerabilities。
- `git diff --check`：通过。
- 本地 beta NSIS：`Skill_Studio_Pro_0.1.0-beta.1_x64-setup.exe`，SHA-256 `ceefd46aa2b4a2a6d444372bae073077326b995acc6abe4cd48b47f9ae277420`；静默安装、主窗口、保持运行 5 秒、隔离 bootstrap 全部 `PASS`。

## 8. 签名、公证、更新与功能边界

- Windows 安装包未做 Authenticode 签名；macOS 未做 Developer ID 签名或 Apple notarization；Linux 安装包未签名。没有伪造签名或付费身份。
- 自动更新关闭；没有 Pro 自有签名更新端点，不声称 updater 可用。
- Public Beta 是未签名测试版，操作系统可能显示未知发布者或安全提示；用户应先核对 Release 中的 `SHA256SUMS.txt`。
- Task 2 对真实 MiniMax/OpenAI 的结论仍为 `NOT_RUN`：没有读取用户 Credential Manager、没有索取或使用真实计费凭据。生产代码支持用户显式配置后的真实 Provider，但本发布不声称真实 Provider 已验收。
- macOS/Linux 的 runner smoke 验证了安装包、直接启动和本地 bootstrap，不等同于 Apple 公证、各发行版桌面集成或所有真实硬件的人工 UAT。
- 自动依赖更新 PR 不替代锁文件、SBOM 与安全审计；Public Beta 的依赖升级仍需重新生成供应链文件并跑完整三平台门槛。

## 9. 外部状态与剩余限制

GitHub 身份检查只有一个明确登录且具备建仓/workflow 权限的身份 `Hao2080`，没有组织或所有权歧义；仓库名不存在冲突，因此按授权直接创建公开仓库和 prerelease。未创建付费服务或代码签名/公证身份。

### 公开 Release 复核

- 匿名网页读取显示仓库为 `Public`、默认分支 `main`；Release 页面显示 `Pre-release`、tag `v0.1.0-beta.1` 与 commit `eb8eb12`，不是仅登录身份可见。
- GitHub Release API 返回 `draft=false`、`prerelease=true`、30 个 `uploaded` 资产、0 个空资产；annotated tag 对象 `58fa3270268f375af7bc6c4af18773ce3aec267c` peeled 到 `eb8eb12bb3a22ee852f461eebe7c6a11c7a4ba9b`。
- 从公开 [Release URL](https://github.com/Hao2080/skill-studio-pro/releases/tag/v0.1.0-beta.1) 下载全部 30 个资产。首次 `gh release download` 在 AppImage 传输到 60 MiB 后遇到瞬时 HTTP/2 `PROTOCOL_ERROR`；随后从 GitHub API 同一公开 release asset 断点续传到 84,003,320 bytes。最终 30/30 文件非空，按下载的 [`SHA256SUMS.txt`](https://github.com/Hao2080/skill-studio-pro/releases/download/v0.1.0-beta.1/SHA256SUMS.txt) 重算 29/29 一致，按 `release-manifest.json` 复核 28/28 bytes/hash 一致。`SHA256SUMS.txt` 自身 SHA-256 为 `a8a22ec43645ec8a70ffbfe91ee07ecd3b5b85d1b1d09793c18d352a0204c50f`。

| 公开资产 | bytes | SHA-256 |
|---|---:|---|
| [Windows x64 NSIS](https://github.com/Hao2080/skill-studio-pro/releases/download/v0.1.0-beta.1/Skill_Studio_Pro_0.1.0-beta.1_x64-setup.exe) | 5,990,759 | `0a5b170431877a7d24362a953956edab0350247a6810d0c5e8418b824f8d7e4a` |
| [macOS arm64 DMG](https://github.com/Hao2080/skill-studio-pro/releases/download/v0.1.0-beta.1/Skill_Studio_Pro_0.1.0-beta.1_aarch64.dmg) | 8,606,010 | `6fb5975e5965f1c27857fb20dafb34509a91405a5a08709cde03ff884772bef4` |
| [Linux amd64 AppImage](https://github.com/Hao2080/skill-studio-pro/releases/download/v0.1.0-beta.1/Skill_Studio_Pro_0.1.0-beta.1_amd64.AppImage) | 84,003,320 | `f07fda6740974e3bb65bd4d01599a6441e54cb4f5bb7c5b7711cc4336002942a` |
| [Linux amd64 deb](https://github.com/Hao2080/skill-studio-pro/releases/download/v0.1.0-beta.1/Skill_Studio_Pro_0.1.0-beta.1_amd64.deb) | 10,214,026 | `73dbadf0b4a6c17577d9692c77727349970acdd4688e25f3d5644a1e9d34bfec` |
| [Frontend CycloneDX](https://github.com/Hao2080/skill-studio-pro/releases/download/v0.1.0-beta.1/frontend.cdx.json) | 256,534 | `8b8d1f11367dc1a76396dc431b6ee6285141dae3fecee4ad82ee41e88882d2d4` |
| [Rust CycloneDX](https://github.com/Hao2080/skill-studio-pro/releases/download/v0.1.0-beta.1/rust.cdx.json) | 640,559 | `502fffeb27a48209eeb4c20c68742c593476f2c39fa97c71089477a285fdbc9c` |
| [Combined CycloneDX](https://github.com/Hao2080/skill-studio-pro/releases/download/v0.1.0-beta.1/skill-studio-pro.cdx.json) | 896,336 | `75d7c264074ae410ce57fcd0ac7e1886c1bbc05f125bc21c3dcf25b100f03bba` |
| [Third-party licenses](https://github.com/Hao2080/skill-studio-pro/releases/download/v0.1.0-beta.1/THIRD-PARTY-LICENSES.json) | 211,044 | `cbe4e86641a061736fd258e19bdf6867919c5beb2bb46099048f562c3adba028` |
| [Release manifest](https://github.com/Hao2080/skill-studio-pro/releases/download/v0.1.0-beta.1/release-manifest.json) | 4,555 | `433133e926705064b20f9674d9b83c5e89d3c2b607129fdf854b1aef58259a3b` |

### Dependabot 最终状态

提交 `86ae8a8` 把 npm、Cargo、GitHub Actions 的 `open-pull-requests-limit` 设为 0，只停止无法自动同步已提交 SBOM/license 文件的定时 version update PR。根据 [GitHub 官方 security updates 文档](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-security-updates)，该值可在保留 security updates 的同时排除 version updates；安全更新使用独立限制，未被关闭。

此前的 version update PR [#13](https://github.com/Hao2080/skill-studio-pro/pull/13)、[#14](https://github.com/Hao2080/skill-studio-pro/pull/14)、[#15](https://github.com/Hao2080/skill-studio-pro/pull/15) 因没有同步生成 SBOM/license 而红，现已逐一关闭并说明必须走完整供应链/三平台门槛。复核公开仓库当前 open PR 为 0；CI 的 npm audit、RustSec、Gitleaks、license policy、锁文件与 SBOM 可复现性检查继续生效。
