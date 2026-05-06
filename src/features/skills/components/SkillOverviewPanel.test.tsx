/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SkillOverviewPanel } from "@/features/skills/components/SkillOverviewPanel";
import type { SkillOverviewViewModel } from "@/features/skills/model/skillOverview";

const { i18nState } = vi.hoisted(() => ({
  i18nState: {
    language: "zh-CN" as "system" | "zh-CN" | "en-US",
    resolvedLanguage: "zh-CN" as "zh-CN" | "en-US",
    antdLocale: {} as object,
    t: vi.fn((key: string) => key),
    setLanguage: vi.fn(),
  },
}));

vi.mock("@/features/settings/state/I18nContext", () => ({
  useI18n: () => i18nState,
}));

function createModel(locale: "zh-CN" | "en-US" = "zh-CN"): SkillOverviewViewModel {
  if (locale === "en-US") {
    return {
      dominantMode: "attention",
      dominantModeLabel: "Needs Convergence",
      dominantModeTone: "warning",
      helperText: "The overview is focused on object state and pending work.",
      nextStep: {
        title: "Let the current version enter platform carrying",
        reason: "The current version is already clear, but no platform is carrying it yet.",
        expectedResult: "Push the current version into the external flow.",
        primaryAction: { type: "open_versions", label: "Release Current Version", section: "release", emphasis: "primary" },
        secondaryActions: [{ type: "open_files", label: "Continue Editing", filePath: "SKILL.md", emphasis: "ghost" }],
      },
      summaryItems: [
        {
          key: "workspace",
          label: "Workspace",
          value: "Aligned with snapshots",
          meta: "Based on v3",
          action: { type: "open_files", label: "Open Files", filePath: "SKILL.md", emphasis: "ghost" },
          tone: "ready",
        },
        {
          key: "version",
          label: "Current Version",
          value: "v3",
          meta: "The current version is aligned with the latest snapshot",
          action: { type: "open_versions", label: "Open Versions", emphasis: "ghost" },
          tone: "ready",
        },
      ],
      lifecycleNodes: [
        {
          key: "workspace",
          label: "Workspace",
          status: "Converged",
          value: "Workspace aligned to v3",
          detail: "The current workspace is aligned with the version flow.",
          meta: null,
          action: { type: "open_files", label: "Open Files", filePath: "SKILL.md", emphasis: "ghost" },
          tone: "ready",
        },
      ],
      attentionItems: [
        {
          key: "missing-platform-carry",
          severity: "attention",
          title: "The current version is not in platform carrying yet",
          detail: "v3 is already current, but no platform is actually carrying it yet.",
          impact: "The overview only reflects the object baseline. It does not mean external release has taken effect.",
          action: { type: "open_versions", label: "View Platform Syncs", section: "release", emphasis: "ghost" },
        },
      ],
      activities: [
        {
          key: "release-1",
          kind: "release",
          title: "Switched Claude.ai to v3",
          detail: "Platform release record recorded.",
          meta: "Apr 20, 09:30 AM",
          timestamp: 3,
          tone: "ready",
          action: { type: "open_versions", label: "View Platform Syncs", section: "release", emphasis: "ghost" },
        },
      ],
    };
  }

  return {
    dominantMode: "attention",
    dominantModeLabel: "需收敛",
    dominantModeTone: "warning",
    helperText: "概览页聚焦对象状态与待处理事项。",
    nextStep: {
      title: "让当前版本进入平台承接",
      reason: "当前版本已经明确，但还没有任何平台承接。",
      expectedResult: "把当前版本推入对外链路。",
      primaryAction: { type: "open_versions", label: "发布当前版本", section: "release", emphasis: "primary" },
      secondaryActions: [{ type: "open_files", label: "继续编辑", filePath: "SKILL.md", emphasis: "ghost" }],
    },
    summaryItems: [
      {
        key: "workspace",
        label: "工作区",
        value: "已与快照对齐",
        meta: "基于 v3",
        action: { type: "open_files", label: "打开文件", filePath: "SKILL.md", emphasis: "ghost" },
        tone: "ready",
      },
      {
        key: "version",
        label: "当前版本",
        value: "v3",
        meta: "当前版本已与最新快照对齐",
        action: { type: "open_versions", label: "查看版本", emphasis: "ghost" },
        tone: "ready",
      },
      {
        key: "release",
        label: "平台承接",
        value: "未承接",
        meta: "2 个平台可直接承接",
        action: { type: "open_versions", label: "查看平台同步", section: "release", emphasis: "ghost" },
        tone: "warning",
      },
      {
        key: "delivery",
        label: "团队交付",
        value: "1 个团队",
        meta: "当前版本已进入团队链路",
        action: { type: "open_versions", label: "查看团队交付", section: "team", emphasis: "ghost" },
        tone: "active",
      },
      {
        key: "recent",
        label: "最近动作",
        value: "4月20日 09:30",
        meta: "已将 Claude.ai 改发为 v3",
        action: { type: "open_versions", label: "查看平台同步", section: "release", emphasis: "ghost" },
        tone: "ready",
      },
    ],
    lifecycleNodes: [
      {
        key: "workspace",
        label: "工作区",
        status: "已收敛",
        value: "工作区已对齐 v3",
        detail: "当前工作副本没有偏离版本链路。",
        meta: null,
        action: { type: "open_files", label: "打开文件", filePath: "SKILL.md", emphasis: "ghost" },
        tone: "ready",
      },
      {
        key: "version",
        label: "当前版本",
        status: "已明确",
        value: "当前版本 v3",
        detail: "最新快照与当前版本已经对齐。",
        meta: "最新快照 v3",
        action: { type: "open_versions", label: "查看版本", section: "detail", emphasis: "ghost" },
        tone: "ready",
      },
      {
        key: "release",
        label: "平台同步",
        status: "待发布",
        value: "v3 尚未进入平台承接",
        detail: "当前版本还没有被任何平台承接，可直接进入版本页发布。",
        meta: "最近平台动作 4月20日 09:30",
        action: { type: "open_versions", label: "查看平台同步", section: "release", emphasis: "ghost" },
        tone: "warning",
      },
      {
        key: "delivery",
        label: "团队交付",
        status: "已承接",
        value: "1 个团队处理 v3",
        detail: "团队承接已经与当前版本一致。",
        meta: "最近团队动作 4月20日 08:00",
        action: { type: "open_versions", label: "查看团队交付", section: "team", emphasis: "ghost" },
        tone: "neutral",
      },
    ],
    attentionItems: [
      {
        key: "missing-platform-carry",
        severity: "attention",
        title: "当前版本尚未进入平台承接",
        detail: "v3 已经是当前版本，但还没有平台真正承接该版本。",
        impact: "概览页看到的是对象基线，不代表对外发布已经生效。",
        action: { type: "open_versions", label: "查看平台同步", section: "release", emphasis: "ghost" },
      },
    ],
    activities: [
      {
        key: "release-1",
        kind: "release",
        title: "已将 Claude.ai 改发为 v3",
        detail: "平台同步记录已写入。",
        meta: "4月20日 09:30",
        timestamp: 3,
        tone: "ready",
        action: { type: "open_versions", label: "查看平台同步", section: "release", emphasis: "ghost" },
      },
      {
        key: "snapshot-3",
        kind: "snapshot",
        title: "已创建快照 v3",
        detail: "当前版本",
        meta: "4月20日 08:00",
        timestamp: 2,
        tone: "active",
        action: { type: "open_versions", label: "查看版本", section: "detail", emphasis: "ghost" },
      },
    ],
  };
}

describe("SkillOverviewPanel", () => {
  beforeEach(() => {
    i18nState.language = "zh-CN";
    i18nState.resolvedLanguage = "zh-CN";
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders overview console and dismissible attention bar", () => {
    render(<SkillOverviewPanel skillId="skill-1" model={createModel()} onAction={vi.fn()} />);

    expect(screen.getByText("让当前版本进入平台承接")).toBeTruthy();
    expect(screen.getByText("平台承接")).toBeTruthy();
    expect(screen.getByText("未承接")).toBeTruthy();
    expect(screen.getByText("已创建快照 v3")).toBeTruthy();
    expect(screen.getByText("当前版本尚未进入平台承接。概览页看到的是对象基线，不代表对外发布已经生效。")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "关闭提示" }));

    expect(
      screen.queryByText("当前版本尚未进入平台承接。概览页看到的是对象基线，不代表对外发布已经生效。"),
    ).toBeNull();
  });

  it("renders english panel copy when ui language is english", () => {
    i18nState.language = "en-US";
    i18nState.resolvedLanguage = "en-US";

    render(<SkillOverviewPanel skillId="skill-1" model={createModel("en-US")} onAction={vi.fn()} />);

    expect(screen.getByText("Flow Status")).toBeTruthy();
    expect(screen.getByText("Needs Attention")).toBeTruthy();
    expect(screen.getByText("Recent Activity")).toBeTruthy();
    expect(
      screen.getByText(
        "The current version is not in platform carrying yet. The overview only reflects the object baseline. It does not mean external release has taken effect.",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close Notice" }));

    expect(
      screen.queryByText(
        "The current version is not in platform carrying yet. The overview only reflects the object baseline. It does not mean external release has taken effect.",
      ),
    ).toBeNull();
  });
});
