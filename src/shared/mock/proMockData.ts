export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export type SourceResolutionStatus = "confirmed" | "inferred" | "unknown";

export interface SourceConfidenceData {
  label: string;
  type: "system" | "plugin" | "git_repository" | "marketplace" | "local_import" | "platform_scan" | "unknown";
  score: number;
  status: SourceResolutionStatus;
  rationale: string;
  evidence: string[];
}

export interface ModelAttributionData {
  provider: "OpenAI" | "MiniMax";
  modelId: string;
  responsibility: string;
  generatedAt: string;
  state: "fresh" | "stale" | "failed" | "disabled";
}

export interface MockSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  platforms: string[];
  path: string;
  source: SourceConfidenceData;
  libraryState: "managed" | "external" | "drifted";
  updatedAt: string;
  hasScripts: boolean;
  duplicateState: "clean" | "duplicate" | "conflict";
  fileCount: number;
  model?: ModelAttributionData;
}

export interface MockPlatform {
  id: string;
  name: string;
  shortName: string;
  detected: boolean;
  enabled: boolean;
  path: string;
  syncMode: "复制" | "符号链接";
  managedCount: number;
  lastSync: string;
  status: "ready" | "attention" | "offline";
}

export interface MockActivity {
  id: string;
  type: "scan" | "import" | "edit" | "publish" | "trash" | "ai";
  title: string;
  target: string;
  time: string;
  status: "success" | "warning" | "failed";
  detail: string;
}

export interface MockTrashEntry {
  id: string;
  name: string;
  originalPath: string;
  source: string;
  deletedAt: string;
  mappings: string[];
  reason: string;
  size: string;
}

export interface MockProviderConfig {
  id: "minimax" | "openai";
  provider: string;
  baseUrl: string;
  modelId: string;
  responsibility: string;
  keyHint: string;
  enabled: boolean;
  connection: "connected" | "not_configured" | "error";
  lastTestedAt?: string;
}

const githubEvidence = [
  "应用安装记录与内容哈希匹配",
  "Git remote 指向 github.com/acme-labs/skill-kit",
  "当前 commit 与安装记录一致",
];

export const mockSkills: MockSkill[] = [
  {
    id: "skill-visual-profile",
    name: "historical-figure-visual-profile",
    description: "将历史人物资料整理为标题、生平与可直接用于绘图的中文视觉描述。",
    tags: ["内容创作", "图像提示词"],
    platforms: ["Codex", "Claude Code"],
    path: "C:\\Users\\demo\\.codex\\skills\\historical-figure-visual-profile",
    source: { label: "Acme Labs / skill-kit", type: "git_repository", score: 96, status: "confirmed", rationale: "安装记录、Git remote 与 commit 三项强证据一致", evidence: githubEvidence },
    libraryState: "managed",
    updatedAt: "今天 14:32",
    hasScripts: false,
    duplicateState: "clean",
    fileCount: 8,
    model: { provider: "OpenAI", modelId: "gpt-5.6", responsibility: "一句话简介与使用建议", generatedAt: "2026-07-15 14:33", state: "fresh" },
  },
  {
    id: "skill-pdf",
    name: "pdf",
    description: "读取、创建、渲染并验证 PDF，适用于布局敏感的文档工作流。",
    tags: ["文档", "PDF"],
    platforms: ["Codex"],
    path: "C:\\Users\\demo\\.codex\\plugins\\pdf\\skills\\pdf",
    source: { label: "Codex 官方插件", type: "plugin", score: 100, status: "confirmed", rationale: "插件 manifest 与系统安装记录精确匹配", evidence: ["插件 manifest 声明该 Skill", "系统插件缓存路径匹配", "安装记录签名有效"] },
    libraryState: "external",
    updatedAt: "昨天 21:08",
    hasScripts: true,
    duplicateState: "clean",
    fileCount: 24,
    model: { provider: "MiniMax", modelId: "MiniMax-Text-01", responsibility: "结构化用法采集", generatedAt: "2026-07-14 21:10", state: "fresh" },
  },
  {
    id: "skill-browser",
    name: "browser-control",
    description: "控制浏览器完成页面检查、交互和本地 Web 视觉验收。",
    tags: ["浏览器", "测试"],
    platforms: ["Codex", "Cursor", "Windsurf"],
    path: "C:\\Users\\demo\\.cursor\\skills\\browser-control",
    source: { label: "Codex Browser 插件", type: "plugin", score: 88, status: "inferred", rationale: "插件路径与文件清单匹配，但缺少本机安装记录", evidence: ["插件缓存路径模式匹配", "SKILL.md 内 provider 字段匹配", "未找到可验证的安装日志"] },
    libraryState: "drifted",
    updatedAt: "7 月 13 日",
    hasScripts: true,
    duplicateState: "conflict",
    fileCount: 17,
    model: { provider: "OpenAI", modelId: "gpt-5.6", responsibility: "冲突解释", generatedAt: "2026-07-13 09:20", state: "stale" },
  },
  {
    id: "skill-sheets",
    name: "spreadsheets",
    description: "创建、分析和验证 Excel、CSV 与 Google Sheets 就绪工作簿。",
    tags: ["表格", "办公"],
    platforms: ["Claude Code", "Gemini CLI"],
    path: "C:\\Users\\demo\\.claude\\skills\\spreadsheets",
    source: { label: "本地导入", type: "local_import", score: 72, status: "inferred", rationale: "目录与内容元数据可对应，未发现远程仓库", evidence: ["本地导入记录存在", "作者 metadata 匹配", "未检测到 Git remote"] },
    libraryState: "managed",
    updatedAt: "7 月 12 日",
    hasScripts: true,
    duplicateState: "duplicate",
    fileCount: 31,
  },
  {
    id: "skill-release-notes",
    name: "release-notes",
    description: "基于提交和 Issue 生成结构清晰的版本发布说明。",
    tags: ["研发", "Git"],
    platforms: ["Cursor"],
    path: "D:\\Projects\\demo\\.cursor\\skills\\release-notes",
    source: { label: "项目目录扫描", type: "platform_scan", score: 41, status: "inferred", rationale: "只确认了 Cursor 项目目录，来源仓库证据不足", evidence: ["Cursor 项目级目录匹配", "目录名与 metadata.name 一致"] },
    libraryState: "external",
    updatedAt: "7 月 10 日",
    hasScripts: false,
    duplicateState: "clean",
    fileCount: 5,
  },
  {
    id: "skill-legacy-helper",
    name: "legacy-helper",
    description: "旧版辅助 Skill，缺少来源信息且包含待检查的 Shell 脚本。",
    tags: ["未分类"],
    platforms: ["Windsurf"],
    path: "C:\\Users\\demo\\.codeium\\windsurf\\skills\\legacy-helper",
    source: { label: "未知来源", type: "unknown", score: 0, status: "unknown", rationale: "没有安装记录、Git remote 或可验证的作者字段", evidence: ["仅检测到已知 Agent 目录"] },
    libraryState: "external",
    updatedAt: "6 月 28 日",
    hasScripts: true,
    duplicateState: "clean",
    fileCount: 9,
  },
];

export const mockPlatforms: MockPlatform[] = [
  { id: "codex", name: "Codex", shortName: "CX", detected: true, enabled: true, path: "~/.codex/skills", syncMode: "复制", managedCount: 18, lastSync: "2 分钟前", status: "ready" },
  { id: "claude", name: "Claude Code", shortName: "CL", detected: true, enabled: true, path: "~/.claude/skills", syncMode: "复制", managedCount: 12, lastSync: "今天 13:44", status: "ready" },
  { id: "cursor", name: "Cursor", shortName: "CU", detected: true, enabled: true, path: "~/.cursor/skills", syncMode: "复制", managedCount: 9, lastSync: "存在 1 项漂移", status: "attention" },
  { id: "windsurf", name: "Windsurf", shortName: "WS", detected: true, enabled: true, path: "~/.codeium/windsurf/skills", syncMode: "复制", managedCount: 5, lastSync: "昨天 19:08", status: "ready" },
  { id: "gemini", name: "Gemini CLI", shortName: "GM", detected: false, enabled: false, path: "~/.gemini/skills", syncMode: "复制", managedCount: 0, lastSync: "尚未同步", status: "offline" },
];

export const mockActivities: MockActivity[] = [
  { id: "op-1", type: "scan", title: "增量扫描完成", target: "5 个扫描根", time: "14:35", status: "success", detail: "发现 2 项更新，外部目录未被修改。" },
  { id: "op-2", type: "ai", title: "摘要已生成", target: "historical-figure-visual-profile", time: "14:33", status: "success", detail: "OpenAI · gpt-5.6 · final_summary/v1" },
  { id: "op-3", type: "publish", title: "发布部分完成", target: "browser-control", time: "13:58", status: "warning", detail: "Codex 成功；Cursor 检测到漂移，已停止覆盖。" },
  { id: "op-4", type: "import", title: "导入完成", target: "spreadsheets", time: "昨天 21:06", status: "success", detail: "已进入中央库并创建初始快照。" },
  { id: "op-5", type: "trash", title: "移入回收站", target: "old-git-helper", time: "7 月 12 日", status: "success", detail: "已保留原路径、来源和 2 个历史映射。" },
];

export const mockTrashEntries: MockTrashEntry[] = [
  { id: "trash-1", name: "old-git-helper", originalPath: "~/.skill-studio-pro/skills/old-git-helper", source: "GitHub / demo-labs/old-git-helper", deletedAt: "2026-07-12 16:20", mappings: ["Codex", "Cursor"], reason: "由用户手动移入回收站", size: "184 KB" },
  { id: "trash-2", name: "draft-writer-v1", originalPath: "~/.skill-studio-pro/skills/draft-writer-v1", source: "本地导入", deletedAt: "2026-07-08 09:41", mappings: ["Claude Code"], reason: "已被新版 Skill 取代", size: "92 KB" },
];

export const mockProviderConfigs: MockProviderConfig[] = [
  { id: "minimax", provider: "MiniMax", baseUrl: "https://api.minimax.io/v1", modelId: "MiniMax-Text-01", responsibility: "结构化采集、标签与用法候选", keyHint: "•••• •••• ••7A", enabled: true, connection: "connected", lastTestedAt: "今天 14:12" },
  { id: "openai", provider: "OpenAI", baseUrl: "https://api.openai.com/v1", modelId: "gpt-5.6", responsibility: "最终简介、冲突解释与内容提炼", keyHint: "尚未配置", enabled: false, connection: "not_configured" },
];

export const mockSkillMarkdown = `---
name: historical-figure-visual-profile
description: 生成历史人物中文视觉内容包
---

# Historical Figure Visual Profile

根据一个历史人物名字生成中文内容包：简洁标题、严格八段生平经历，
以及严格八段具有镜头、环境和时代细节的画面描述。

## 使用方式

输入历史人物姓名；必要时补充希望强调的时代或视觉风格。

## 输出约束

- 标题不超过十个汉字
- 生平必须包含出生与逝世
- 画面描述需避免现代物件穿帮
`;

export const mockFileTree = [
  { path: "SKILL.md", type: "Markdown", size: "6.2 KB" },
  { path: "references/visual-language.md", type: "Markdown", size: "14.8 KB" },
  { path: "references/historical-periods.md", type: "Markdown", size: "9.4 KB" },
  { path: "assets/prompt-template.txt", type: "Text", size: "2.1 KB" },
  { path: "tests/examples.json", type: "JSON", size: "4.7 KB" },
];
