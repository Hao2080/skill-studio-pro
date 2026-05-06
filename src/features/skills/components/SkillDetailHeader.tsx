import type { MenuProps } from "antd";
import Button from "antd/es/button";
import Dropdown from "antd/es/dropdown";
import { openPath } from "@tauri-apps/plugin-opener";
import { ArrowLeft, FolderTree, History, MoreHorizontal, Settings } from "lucide-react";
import { useI18n } from "@/features/settings/state/I18nContext";
import { openSkillFolder } from "@/features/skills/api/skillsApi";
import { formatSkillUpdatedAt, getPrimarySkillSourceLabel } from "@/features/skills/model/detailWorkspace";
import type { Skill, SkillSource } from "@/types/skill";

export interface SkillDetailStatusCard {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: "active" | "neutral" | "ready" | "warning";
  onClick: () => void;
}

interface SkillDetailHeaderProps {
  skill: Skill | null;
  primarySource?: SkillSource | null;
  onBack: () => void;
  onOpenFiles?: () => void;
  onOpenVersions?: () => void;
  onOpenSettings?: () => void;
}

type HeaderLanguage = "zh-CN" | "en-US";

interface SkillDetailHeaderMetaItem {
  key: string;
  label: string;
  value: string;
  title?: string;
  mono?: boolean;
  order?: number;
}

interface SkillDetailHeaderSourceMeta {
  items: SkillDetailHeaderMetaItem[];
  sourceHref: string | null;
  openPath: string | null;
  copyValue: string | null;
}

function parseSourceMetadata(metadataJson: string | null | undefined): Record<string, unknown> | null {
  if (!metadataJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(metadataJson);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readMetadataText(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getPathLeaf(pathValue: string | null | undefined): string | null {
  if (!pathValue?.trim()) {
    return null;
  }

  const normalized = pathValue.trim().replace(/[\\/]+$/, "");
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? null;
}

function getCompactPathDisplay(pathValue: string | null | undefined): string | null {
  if (!pathValue?.trim()) {
    return null;
  }

  const trimmed = pathValue.trim().replace(/[\\/]+$/, "");
  const isWindowsPath = /^[a-zA-Z]:[\\/]/.test(trimmed);
  const separator = trimmed.includes("\\") ? "\\" : "/";
  const segments = trimmed.split(/[\\/]/).filter(Boolean);

  if (segments.length <= 3) {
    return trimmed;
  }

  if (isWindowsPath) {
    const drive = segments[0] ?? "";
    const tail = segments.slice(-2).join("\\");
    return `${drive}\\...\\${tail}`;
  }

  const tail = segments.slice(-2).join(separator);
  return `${trimmed.startsWith("/") ? "/" : ""}...${separator}${tail}`;
}

function getRepositoryDisplay(reference: string | null | undefined): {
  display: string | null;
  href: string | null;
  title: string | null;
} {
  if (!reference?.trim()) {
    return {
      display: null,
      href: null,
      title: null,
    };
  }

  const trimmed = reference.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const pathname = url.pathname.replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
      return {
        display: pathname || trimmed,
        href: trimmed,
        title: trimmed,
      };
    } catch {
      return {
        display: trimmed.replace(/\.git$/i, ""),
        href: trimmed,
        title: trimmed,
      };
    }
  }

  return {
    display: trimmed.replace(/\.git$/i, ""),
    href: null,
    title: trimmed,
  };
}

function buildSourceMeta(
  skill: Skill | null,
  primarySource: SkillSource | null,
  locale: HeaderLanguage,
  copy: {
    sourceMethod: string;
    sourceRepository: string;
    sourceDirectory: string;
    sourcePath: string;
    skillIdentifier: string;
    sourceEntry: string;
    teamSourceFallback: string;
  },
): SkillDetailHeaderSourceMeta {
  const items: SkillDetailHeaderMetaItem[] = [
    {
      key: "source-method",
      label: copy.sourceMethod,
      value: getPrimarySkillSourceLabel(skill?.sourceType, primarySource, locale),
      order: 1,
    },
  ];

  if (!primarySource) {
    return {
      items,
      sourceHref: null,
      openPath: null,
      copyValue: null,
    };
  }

  const metadata = parseSourceMetadata(primarySource.metadataJson);
  const repoSubdir = readMetadataText(metadata, "repoSubdir");
  const skillFolderName = readMetadataText(metadata, "skillFolderName");
  const externalSource = readMetadataText(metadata, "source");
  const skillId = readMetadataText(metadata, "skillId");
  const repoUrl = readMetadataText(metadata, "repoUrl");
  const sourceSubpath = readMetadataText(metadata, "sourceSubpath");
  const sourcePath = primarySource.sourcePath ?? primarySource.sourceRef ?? null;
  const sourceRepository = getRepositoryDisplay(repoUrl ?? primarySource.sourceRef ?? null);
  const localIdentifier = skillFolderName ?? skill?.slug ?? getPathLeaf(sourcePath);

  switch (primarySource.sourceType) {
    case "git_repository": {
      if (sourceRepository.display) {
        items.push({
          key: "source-repository",
          label: copy.sourceRepository,
          value: sourceRepository.display,
          title: sourceRepository.title ?? sourceRepository.display,
          order: 2,
        });
      }

      if (repoSubdir) {
        items.push({
          key: "source-path",
          label: copy.sourcePath,
          value: repoSubdir,
          title: repoSubdir,
          mono: true,
          order: 4,
        });
      }

      return {
        items,
        sourceHref: sourceRepository.href,
        openPath: null,
        copyValue: repoSubdir ?? sourceRepository.title ?? primarySource.sourceRef ?? null,
      };
    }
    case "skillssh": {
      const repositoryValue = externalSource ?? sourceRepository.display;
      if (repositoryValue) {
        items.push({
          key: "source-repository",
          label: copy.sourceRepository,
          value: repositoryValue,
          title: repositoryValue,
          order: 2,
        });
      }

      const remotePath = sourceSubpath ?? skillId;
      if (remotePath) {
        items.push({
          key: "source-path",
          label: sourceSubpath ? copy.sourcePath : copy.skillIdentifier,
          value: remotePath,
          title: remotePath,
          mono: true,
          order: sourceSubpath ? 4 : 2,
        });
      }

      return {
        items,
        sourceHref: sourceRepository.href,
        openPath: null,
        copyValue: sourceSubpath ?? skillId ?? externalSource ?? repoUrl ?? primarySource.sourceRef ?? null,
      };
    }
    case "local":
    case "platform_scan": {
      if (localIdentifier) {
        items.push({
          key: "skill-identifier",
          label: copy.skillIdentifier,
          value: localIdentifier,
          title: localIdentifier,
          mono: true,
          order: 2,
        });
      }

      if (sourcePath) {
        items.push({
          key: "source-directory",
          label: copy.sourceDirectory,
          value: getCompactPathDisplay(sourcePath) ?? sourcePath,
          title: sourcePath,
          mono: true,
          order: 4,
        });
      }

      return {
        items,
        sourceHref: null,
        openPath: sourcePath,
        copyValue: sourcePath,
      };
    }
    case "market_catalog": {
      const sourceEntry = primarySource.sourceRef ?? skillId;
      if (sourceEntry) {
        items.push({
          key: "source-entry",
          label: copy.sourceEntry,
          value: sourceEntry,
          title: sourceEntry,
          order: 2,
        });
      }

      return {
        items,
        sourceHref: null,
        openPath: null,
        copyValue: sourceEntry,
      };
    }
    case "team_library": {
      const sourceEntry = primarySource.sourceRef ?? copy.teamSourceFallback;
      items.push({
        key: "source-entry",
        label: copy.sourceEntry,
        value: sourceEntry,
        title: sourceEntry,
        order: 2,
      });

      return {
        items,
        sourceHref: null,
        openPath: null,
        copyValue: primarySource.sourceRef ?? null,
      };
    }
    default: {
      const sourceEntry = sourcePath ?? primarySource.sourceRef ?? null;
      if (sourceEntry) {
        items.push({
          key: "source-entry",
          label: copy.sourceEntry,
          value: sourceEntry,
          title: sourceEntry,
          mono: /[\\/]/.test(sourceEntry),
          order: /[\\/]/.test(sourceEntry) ? 4 : 2,
        });
      }

      return {
        items,
        sourceHref: sourceRepository.href,
        openPath: null,
        copyValue: sourceEntry,
      };
    }
  }
}

export function SkillDetailHeader({
  skill,
  primarySource = null,
  onBack,
  onOpenFiles,
  onOpenVersions,
  onOpenSettings,
}: SkillDetailHeaderProps) {
  const { resolvedLanguage } = useI18n();
  const locale: HeaderLanguage = resolvedLanguage === "en-US" ? "en-US" : "zh-CN";
  const copy = locale === "en-US"
    ? {
        sourceMethod: "Source Method",
        updated: "Updated",
        loading: "Loading",
        viewFiles: "Open Files",
        viewVersions: "Open Versions",
        platformSettings: "Platform Settings",
        openDirectory: "Open Folder",
        viewRepository: "View Repo",
        copy: "Copy",
        sourceRepository: "Repository",
        sourceDirectory: "Source Directory",
        sourcePath: "Skill Path",
        skillIdentifier: "Skill ID",
        sourceEntry: "Source Entry",
        teamSourceFallback: "Team Version Pull",
        back: "Back to Skill Assets",
        defaultTitle: "Skill Workspace",
        actions: "Skill object actions",
        more: "More",
        meta: "Skill metadata",
      }
    : {
        sourceMethod: "来源方式",
        updated: "更新",
        loading: "等待加载",
        viewFiles: "查看文件",
        viewVersions: "查看版本",
        platformSettings: "平台设置",
        openDirectory: "打开目录",
        viewRepository: "查看仓库",
        copy: "复制",
        sourceRepository: "来源仓库",
        sourceDirectory: "来源目录",
        sourcePath: "技能路径",
        skillIdentifier: "技能标识",
        sourceEntry: "来源条目",
        teamSourceFallback: "团队版本拉取",
        back: "返回技能资产",
        defaultTitle: "技能详情",
        actions: "技能对象操作",
        more: "更多",
        meta: "技能基础信息",
      };
  const sourceMeta = buildSourceMeta(skill, primarySource, locale, copy);
  const metadataItems: SkillDetailHeaderMetaItem[] = [
    ...sourceMeta.items,
    {
      key: "updated",
      label: copy.updated,
      value: skill ? formatSkillUpdatedAt(skill.updatedAt, locale) : copy.loading,
      order: 3,
    },
  ].sort((left, right) => (left.order ?? 99) - (right.order ?? 99));
  const actionItems = [
    onOpenFiles
      ? {
          key: "files",
          label: copy.viewFiles,
          icon: <FolderTree size={14} />,
          onClick: onOpenFiles,
        }
      : null,
    onOpenVersions
      ? {
          key: "versions",
          label: copy.viewVersions,
          icon: <History size={14} />,
          onClick: onOpenVersions,
        }
      : null,
    onOpenSettings
      ? {
          key: "settings",
          label: copy.platformSettings,
          icon: <Settings size={14} />,
          onClick: onOpenSettings,
        }
      : null,
  ].filter(Boolean) as MenuProps["items"];

  const handleCopySource = async () => {
    if (!sourceMeta.copyValue || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(sourceMeta.copyValue);
    } catch {
      // Ignore clipboard failures in the compact header actions.
    }
  };

  const handleOpenDirectory = async () => {
    const targetPath = sourceMeta.openPath;
    if (targetPath) {
      try {
        await openPath(targetPath);
        return;
      } catch {
        // Fall back to the managed workspace path below when available.
      }
    }

    if (!skill?.id) {
      return;
    }

    try {
      await openSkillFolder(skill.id);
    } catch {
      // Ignore opener failures in the compact header actions.
    }
  };

  return (
    <section className="skill-detail-header skill-detail-header--dense">
      <div className="skill-detail-header__frame">
        <div className="skill-detail-header__mainline">
          <div className="skill-detail-header__toolbar">
            <Button type="link" className="skill-detail-header__back" icon={<ArrowLeft size={14} />} onClick={onBack}>
              {copy.back}
            </Button>
            <div className="skill-detail-header__actions" role="group" aria-label={copy.actions}>
              <Dropdown menu={{ items: actionItems }} trigger={["click"]} overlayClassName="skill-detail-header__menu">
                <Button
                  className="skill-detail-header__action skill-detail-header__action--menu"
                  icon={<MoreHorizontal size={14} />}
                  aria-label={copy.more}
                  title={copy.more}
                />
              </Dropdown>
            </div>
          </div>

          <div className="skill-detail-header__heading-row">
            <div className="skill-detail-header__identity">
              <div className="skill-detail-header__title-row">
                <h1 title={skill?.name ?? copy.defaultTitle}>{skill?.name ?? copy.defaultTitle}</h1>
              </div>
            </div>
          </div>

          {skill?.description?.trim() ? (
            <p className="skill-detail-header__summary" title={skill.description}>
              {skill.description}
            </p>
          ) : null}

          <div className="skill-detail-header__meta-line" aria-label={copy.meta}>
            {metadataItems.map((item) => (
              <span key={item.key} className="skill-detail-header__meta-item">
                <span className="skill-detail-header__meta-label">{item.label}</span>
                <span className="skill-detail-header__meta-divider" aria-hidden="true" />
                <span
                  className={`skill-detail-header__meta-value${item.mono ? " skill-detail-header__meta-value--mono" : ""}`}
                  title={item.title ?? item.value}
                >
                  {item.value}
                </span>
              </span>
            ))}

            {sourceMeta.sourceHref || sourceMeta.openPath || sourceMeta.copyValue ? (
              <div className="skill-detail-header__meta-actions">
                {sourceMeta.openPath ? (
                  <Button className="skill-detail-header__meta-action" onClick={() => void handleOpenDirectory()}>
                    {copy.openDirectory}
                  </Button>
                ) : null}
                {sourceMeta.sourceHref ? (
                  <Button
                    className="skill-detail-header__meta-action"
                    href={sourceMeta.sourceHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {copy.viewRepository}
                  </Button>
                ) : null}
                {sourceMeta.copyValue ? (
                  <Button className="skill-detail-header__meta-action" onClick={() => void handleCopySource()}>
                    {copy.copy}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
