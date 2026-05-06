import type { PlatformConnection, TestPlatformPathResult } from "@/types/skill";

export const PREVIEW_BASE_TIME = new Date("2026-04-20T10:30:00+08:00").getTime();
export const PREVIEW_HOME = "C:/Users/demo";

interface BuiltInPreviewPlatformDefinition {
  platformName: string;
  displayName: string;
  skillsDirRel: string;
}

const BUILT_IN_PREVIEW_PLATFORM_DEFINITIONS: BuiltInPreviewPlatformDefinition[] = [
  { platformName: "cursor", displayName: "Cursor", skillsDirRel: ".cursor/skills" },
  { platformName: "claude", displayName: "Claude Code", skillsDirRel: ".claude/skills" },
  { platformName: "codex", displayName: "Codex", skillsDirRel: ".codex/skills" },
  { platformName: "opencode", displayName: "OpenCode", skillsDirRel: ".config/opencode/skills" },
  { platformName: "antigravity", displayName: "Antigravity", skillsDirRel: ".gemini/antigravity/skills" },
  { platformName: "amp", displayName: "Amp", skillsDirRel: ".config/agents/skills" },
  { platformName: "kilo_code", displayName: "Kilo Code", skillsDirRel: ".kilocode/skills" },
  { platformName: "roo_code", displayName: "Roo Code", skillsDirRel: ".roo/skills" },
  { platformName: "goose", displayName: "Goose", skillsDirRel: ".config/goose/skills" },
  { platformName: "gemini", displayName: "Gemini CLI", skillsDirRel: ".gemini/skills" },
  { platformName: "github_copilot", displayName: "GitHub Copilot", skillsDirRel: ".copilot/skills" },
  { platformName: "openclaw", displayName: "OpenClaw", skillsDirRel: ".openclaw/skills" },
  { platformName: "droid", displayName: "Droid", skillsDirRel: ".factory/skills" },
  { platformName: "windsurf", displayName: "Windsurf", skillsDirRel: ".codeium/windsurf/skills" },
  { platformName: "trae", displayName: "TRAE IDE", skillsDirRel: ".trae/skills" },
  { platformName: "cline", displayName: "Cline", skillsDirRel: ".agents/skills" },
  { platformName: "deepagents", displayName: "Deep Agents", skillsDirRel: ".deepagents/agent/skills" },
  { platformName: "firebender", displayName: "Firebender", skillsDirRel: ".firebender/skills" },
  { platformName: "kimi", displayName: "Kimi Code CLI", skillsDirRel: ".config/agents/skills" },
  { platformName: "replit", displayName: "Replit", skillsDirRel: ".config/agents/skills" },
  { platformName: "warp", displayName: "Warp", skillsDirRel: ".agents/skills" },
  { platformName: "augment", displayName: "Augment", skillsDirRel: ".augment/skills" },
  { platformName: "bob", displayName: "IBM Bob", skillsDirRel: ".bob/skills" },
  { platformName: "codebuddy", displayName: "CodeBuddy", skillsDirRel: ".codebuddy/skills" },
  { platformName: "command_code", displayName: "Command Code", skillsDirRel: ".commandcode/skills" },
  { platformName: "continue", displayName: "Continue", skillsDirRel: ".continue/skills" },
  { platformName: "cortex", displayName: "Cortex Code", skillsDirRel: ".snowflake/cortex/skills" },
  { platformName: "crush", displayName: "Crush", skillsDirRel: ".config/crush/skills" },
  { platformName: "iflow", displayName: "iFlow CLI", skillsDirRel: ".iflow/skills" },
  { platformName: "junie", displayName: "Junie", skillsDirRel: ".junie/skills" },
  { platformName: "kiro", displayName: "Kiro CLI", skillsDirRel: ".kiro/skills" },
  { platformName: "kode", displayName: "Kode", skillsDirRel: ".kode/skills" },
  { platformName: "mcpjam", displayName: "MCPJam", skillsDirRel: ".mcpjam/skills" },
  { platformName: "mistral_vibe", displayName: "Mistral Vibe", skillsDirRel: ".vibe/skills" },
  { platformName: "mux", displayName: "Mux", skillsDirRel: ".mux/skills" },
  { platformName: "neovate", displayName: "Neovate", skillsDirRel: ".neovate/skills" },
  { platformName: "openhands", displayName: "OpenHands", skillsDirRel: ".openhands/skills" },
  { platformName: "pi", displayName: "Pi", skillsDirRel: ".pi/agent/skills" },
  { platformName: "pochi", displayName: "Pochi", skillsDirRel: ".pochi/skills" },
  { platformName: "qoder", displayName: "Qoder", skillsDirRel: ".qoder/skills" },
  { platformName: "qwen_code", displayName: "Qwen Code", skillsDirRel: ".qwen/skills" },
  { platformName: "trae_cn", displayName: "TRAE CN", skillsDirRel: ".trae-cn/skills" },
  { platformName: "zencoder", displayName: "Zencoder", skillsDirRel: ".zencoder/skills" },
  { platformName: "adal", displayName: "AdaL", skillsDirRel: ".adal/skills" },
  { platformName: "hermes", displayName: "Hermes Agent", skillsDirRel: ".hermes/skills" },
];

const BUILT_IN_PREVIEW_PLATFORM_MAP = new Map(
  BUILT_IN_PREVIEW_PLATFORM_DEFINITIONS.map((definition) => [definition.platformName, definition]),
);

function buildPreviewSkillsDir(skillsDirRel: string) {
  return `${PREVIEW_HOME}/${skillsDirRel}`;
}

export function getPreviewDefaultSkillsDir(platformName: string, fallbackRel = ".skills") {
  return buildPreviewSkillsDir(BUILT_IN_PREVIEW_PLATFORM_MAP.get(platformName)?.skillsDirRel ?? fallbackRel);
}

function buildPreviewDetectDir(skillsDirRel: string) {
  return `${PREVIEW_HOME}/${skillsDirRel.replace(/\/skills$/, "")}`;
}

export function normalizePreviewPath(value: string) {
  return value.replace(/\\/g, "/").trim();
}

export function normalizePreviewPlatformKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split("")
    .map((char) => {
      if (/^[a-z0-9]$/.test(char)) {
        return char;
      }

      if (char === " " || char === "-" || char === ".") {
        return "_";
      }

      return "";
    })
    .join("");
}

export function resolvePreviewSyncMode(
  syncMode: string | undefined,
  supportsCopy: boolean | undefined,
  supportsSymlink: boolean | undefined,
) {
  if (syncMode === "symlink" && supportsSymlink) {
    return "symlink";
  }

  if (supportsCopy !== false) {
    return "copy";
  }

  if (supportsSymlink) {
    return "symlink";
  }

  return "copy";
}

export function resolvePreviewDetectDir(platform: PlatformConnection, skillsDir?: string) {
  const normalizedSkillsDir = normalizePreviewPath(skillsDir ?? "");
  if (!normalizedSkillsDir) {
    return undefined;
  }

  if (platform.platformType !== "built_in") {
    return normalizedSkillsDir;
  }

  const definition = BUILT_IN_PREVIEW_PLATFORM_MAP.get(platform.platformName);
  if (!definition) {
    return normalizedSkillsDir;
  }

  const defaultSkillsDir = normalizePreviewPath(buildPreviewSkillsDir(definition.skillsDirRel));
  if (normalizedSkillsDir === defaultSkillsDir) {
    return normalizePreviewPath(buildPreviewDetectDir(definition.skillsDirRel));
  }

  return normalizedSkillsDir;
}

export function sortPreviewPlatforms(platforms: PlatformConnection[]) {
  return [...platforms].sort((left, right) =>
    (left.displayName ?? left.platformName)
      .toLowerCase()
      .localeCompare((right.displayName ?? right.platformName).toLowerCase()) ||
    left.platformName.toLowerCase().localeCompare(right.platformName.toLowerCase()),
  );
}

export function evaluatePreviewPath(skillsDir: string): TestPlatformPathResult {
  const normalizedPath = normalizePreviewPath(skillsDir);

  if (!normalizedPath) {
    return {
      ok: false,
      normalizedPath,
      exists: false,
      isDirectory: false,
      message: "目录不能为空，请先填写平台技能目录。",
    };
  }

  const lowerCasePath = normalizedPath.toLowerCase();
  if (
    lowerCasePath.includes("missing") ||
    lowerCasePath.includes("not-found") ||
    lowerCasePath.includes("invalid")
  ) {
    return {
      ok: false,
      normalizedPath,
      exists: false,
      isDirectory: false,
      message: "目录不存在，请确认路径后重试。",
    };
  }

  if (/\.(md|txt|json)$/i.test(lowerCasePath)) {
    return {
      ok: false,
      normalizedPath,
      exists: true,
      isDirectory: false,
      message: "当前路径存在，但不是文件夹。",
    };
  }

  return {
    ok: true,
    normalizedPath,
    exists: true,
    isDirectory: true,
    message: "目录检测通过，可作为平台技能目录使用。",
  };
}

export function buildPreviewPlatforms(): PlatformConnection[] {
  const detectedState = new Map<
    string,
    { enabled?: boolean; syncMode?: "copy" | "symlink"; lastSyncAt?: number }
  >([
    ["cursor", { enabled: true, syncMode: "symlink", lastSyncAt: PREVIEW_BASE_TIME - 1000 * 60 * 210 }],
    ["claude", { enabled: true, syncMode: "symlink", lastSyncAt: PREVIEW_BASE_TIME - 1000 * 60 * 240 }],
    ["codex", { enabled: true, syncMode: "copy", lastSyncAt: PREVIEW_BASE_TIME - 1000 * 60 * 120 }],
    ["gemini", { enabled: false, syncMode: "copy" }],
    ["github_copilot", { enabled: true, syncMode: "copy", lastSyncAt: PREVIEW_BASE_TIME - 1000 * 60 * 310 }],
    ["openhands", { enabled: false, syncMode: "copy" }],
    ["qwen_code", { enabled: true, syncMode: "copy", lastSyncAt: PREVIEW_BASE_TIME - 1000 * 60 * 95 }],
    ["hermes", { enabled: false, syncMode: "copy" }],
  ]);

  const builtInPlatforms = BUILT_IN_PREVIEW_PLATFORM_DEFINITIONS.map((definition) => {
    const detectedStateItem = detectedState.get(definition.platformName);
    const detected = Boolean(detectedStateItem);

    return {
      id: `platform-${definition.platformName}`,
      platformName: definition.platformName,
      displayName: definition.displayName,
      platformType: "built_in",
      detected,
      enabled: detectedStateItem?.enabled ?? false,
      skillsDir: buildPreviewSkillsDir(definition.skillsDirRel),
      detectDir: buildPreviewDetectDir(definition.skillsDirRel),
      syncMode: detectedStateItem?.syncMode ?? "copy",
      supportsProjectScope: false,
      supportsSymlink: true,
      supportsCopy: true,
      lastSyncAt: detectedStateItem?.lastSyncAt,
    } satisfies PlatformConnection;
  });

  const customPlatforms: PlatformConnection[] = [
    {
      id: "platform-studio_internal",
      platformName: "studio_internal",
      displayName: "Studio Internal Agents",
      platformType: "custom",
      detected: true,
      enabled: true,
      skillsDir: "D:/AgentStudio/internal-skills",
      detectDir: "D:/AgentStudio/internal-skills",
      syncMode: "copy",
      supportsProjectScope: true,
      supportsSymlink: true,
      supportsCopy: true,
      lastSyncAt: PREVIEW_BASE_TIME - 1000 * 60 * 55,
    },
  ];

  return sortPreviewPlatforms([...builtInPlatforms, ...customPlatforms]);
}
