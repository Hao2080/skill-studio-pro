/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "antd/es/app";
import { MemoryRouter } from "react-router-dom";
import type { ExternalMarketSkill, MarketCatalogItem, Skill, SkillImportRecord, SkillSource } from "@/types/skill";
import { MarketPage } from "@/features/market/pages/MarketPage";

const {
  i18nState,
  messageErrorMock,
  messageSuccessMock,
  messageWarningMock,
  useAppMock,
  mockedNavigate,
  getMarketCatalogItemsMock,
  getExternalMarketSkillsMock,
  getMarketExternalSkillDetailMock,
  searchMarketSkillsMock,
  importExternalMarketSkillMock,
  importMarketSkillMock,
  importSkillMock,
  importSkillFromGitMock,
  listSkillImportRecordsMock,
  listSkillSourcesMock,
  openSkillImportDialogMock,
} = vi.hoisted(() => ({
  i18nState: {
    language: "zh-CN" as "system" | "zh-CN" | "en-US",
    resolvedLanguage: "zh-CN" as "zh-CN" | "en-US",
    antdLocale: {} as object,
    t: vi.fn((key: string) => key),
    setLanguage: vi.fn(),
  },
  messageErrorMock: vi.fn(),
  messageSuccessMock: vi.fn(),
  messageWarningMock: vi.fn(),
  mockedNavigate: vi.fn(),
  getMarketCatalogItemsMock: vi.fn(),
  getExternalMarketSkillsMock: vi.fn(),
  getMarketExternalSkillDetailMock: vi.fn(),
  searchMarketSkillsMock: vi.fn(),
  importExternalMarketSkillMock: vi.fn(),
  importMarketSkillMock: vi.fn(),
  importSkillMock: vi.fn(),
  importSkillFromGitMock: vi.fn(),
  listSkillImportRecordsMock: vi.fn(),
  listSkillSourcesMock: vi.fn(),
  openSkillImportDialogMock: vi.fn(),
  useAppMock: vi.fn(() => ({
    message: {
      info: vi.fn(),
      error: messageErrorMock,
      warning: messageWarningMock,
      success: messageSuccessMock,
    },
    notification: {
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      open: vi.fn(),
      destroy: vi.fn(),
    },
    modal: {
      confirm: vi.fn(),
    },
  })),
}));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    matches: false,
    media: "",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock("antd/es/app", async () => {
  const actual = await vi.importActual<typeof import("antd/es/app")>("antd/es/app");
  const mockedApp = actual.default;
  mockedApp.useApp = useAppMock as unknown as typeof mockedApp.useApp;
  return {
    __esModule: true,
    default: mockedApp,
  };
});

vi.mock("../api/marketApi", () => ({
  getMarketCatalogItems: getMarketCatalogItemsMock,
  getExternalMarketSkills: getExternalMarketSkillsMock,
  getMarketExternalSkillDetail: getMarketExternalSkillDetailMock,
  searchMarketSkills: searchMarketSkillsMock,
}));

vi.mock("@/features/skills/api/skillsApi", () => ({
  importExternalMarketSkill: importExternalMarketSkillMock,
  importMarketSkill: importMarketSkillMock,
  importSkill: importSkillMock,
  importSkillFromGit: importSkillFromGitMock,
  listSkillImportRecords: listSkillImportRecordsMock,
  listSkillSources: listSkillSourcesMock,
  openSkillImportDialog: openSkillImportDialogMock,
}));

const skillContextMock: {
  skills: Skill[];
  loadSkills: ReturnType<typeof vi.fn>;
  selectSkill: ReturnType<typeof vi.fn>;
} = {
  skills: [],
  loadSkills: vi.fn(),
  selectSkill: vi.fn(),
};

vi.mock("@/features/skills/state/SkillContext", () => ({
  useSkillContext: () => skillContextMock,
}));

vi.mock("@/features/settings/state/I18nContext", () => ({
  useI18n: () => i18nState,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

function renderPage() {
  return render(
    <App>
      <MemoryRouter>
        <MarketPage />
      </MemoryRouter>
    </App>,
  );
}

async function findArticleByText(text: string) {
  const matches = await screen.findAllByText(text);
  return matches[0]?.closest("article") ?? null;
}

function buildExternalSkill(overrides: Partial<ExternalMarketSkill> & Pick<ExternalMarketSkill, "id" | "name" | "source" | "skillId">): ExternalMarketSkill {
  return {
    id: overrides.id,
    marketSource: overrides.marketSource ?? "skillssh",
    sourceKeys: overrides.sourceKeys ?? ["skillssh"],
    name: overrides.name,
    summary: "示例摘要",
    source: overrides.source,
    sourceLabel: overrides.source,
    skillId: overrides.skillId,
    publisher: overrides.source.split("/")[0] || overrides.source,
    repoUrl: overrides.repoUrl ?? "https://github.com/openai/skills.git",
    sourceSubpath: overrides.sourceSubpath,
    category: overrides.category ?? "通用工具",
    accentColor: overrides.accentColor ?? "#58a6ff",
    tags: overrides.tags ?? [],
    installs: overrides.installs ?? 0,
    featured: overrides.featured ?? false,
    verification: overrides.verification ?? "verified",
    risk: overrides.risk ?? "low",
    facets: overrides.facets ?? [],
    metrics: overrides.metrics ?? [],
    detailUrl: overrides.detailUrl ?? overrides.repoUrl ?? "https://github.com/openai/skills.git",
    packageName: overrides.packageName,
    packageVersion: overrides.packageVersion,
    ownerHandle: overrides.ownerHandle,
    updatedAt: overrides.updatedAt,
  };
}

describe("MarketPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18nState.language = "zh-CN";
    i18nState.resolvedLanguage = "zh-CN";

    const catalog: MarketCatalogItem[] = [
      {
        id: "market-product",
        name: "产品管理模板",
        summary: "覆盖产品分析与交付节奏",
        description: "适合产品和研发协同的技能模板。",
        category: "产品治理",
        author: "官方精选",
        difficulty: "进阶",
        featured: true,
        accentColor: "#58a6ff",
        tags: ["产品", "治理"],
      },
    ];
    const aggregateSkills: ExternalMarketSkill[] = [
      buildExternalSkill({
        id: "all:openai/skills/browser",
        marketSource: "officialskills",
        sourceKeys: ["skillssh", "officialskills"],
        name: "browser",
        summary: "聚焦界面、浏览器自动化与前端工作流，来自 openai/skills，当前安装量 120。",
        source: "openai/skills",
        sourceLabel: "OpenAI/skills",
        skillId: "browser",
        publisher: "OpenAI",
        repoUrl: "https://github.com/openai/skills.git",
        category: "前端开发",
        accentColor: "#58a6ff",
        tags: ["界面", "浏览器", "前端"],
        installs: 120,
        featured: true,
        verification: "official",
        risk: "low",
        facets: [
          { label: "Category", value: "Development" },
          { label: "Team", value: "OpenAI" },
          { label: "Rank", value: "Top 50" },
        ],
        metrics: [
          { label: "Installs", value: "120" },
          { label: "Source", value: "officialskills.sh" },
        ],
      }),
      buildExternalSkill({
        id: "all:openai/skills/installed-browser",
        marketSource: "skillssh",
        sourceKeys: ["skillssh"],
        name: "installed-browser",
        summary: "已经导入过的浏览器技能。",
        source: "openai/skills",
        skillId: "installed-browser",
        publisher: "openai",
        repoUrl: "https://github.com/openai/skills.git",
        category: "前端开发",
        accentColor: "#58a6ff",
        tags: ["已导入", "浏览器"],
        installs: 98,
        featured: false,
        verification: "verified",
        risk: "low",
        facets: [
          { label: "Repository", value: "openai/skills" },
          { label: "Category", value: "前端开发" },
          { label: "Usage", value: "98" },
        ],
        metrics: [
          { label: "Installs", value: "98" },
          { label: "Tags", value: "浏览器" },
        ],
      }),
      buildExternalSkill({
        id: "all:team/skills/git skill",
        marketSource: "skillssh",
        sourceKeys: ["skillssh"],
        name: "git skill",
        summary: "会与现有仓库技能产生 slug 冲突。",
        source: "team/skills",
        sourceLabel: "team/skills",
        skillId: "git skill",
        publisher: "team",
        repoUrl: "https://github.com/team/skills.git",
        category: "团队空间",
        accentColor: "#a371f7",
        tags: ["协作", "冲突"],
        installs: 12,
        featured: false,
        verification: "verified",
        risk: "low",
        facets: [
          { label: "Repository", value: "team/skills" },
          { label: "Category", value: "团队空间" },
          { label: "Usage", value: "12" },
        ],
        metrics: [
          { label: "Installs", value: "12" },
          { label: "Tags", value: "协作 / 冲突" },
        ],
      }),
    ];

    const officialSourceSkills: ExternalMarketSkill[] = [
      buildExternalSkill({
        id: "officialskills:openai/skills/browser",
        marketSource: "officialskills",
        sourceKeys: ["officialskills"],
        name: "browser",
        summary: "OpenAI 官方团队目录中的 browser。",
        source: "openai/skills",
        sourceLabel: "OpenAI/skills",
        skillId: "browser",
        publisher: "OpenAI",
        repoUrl: "https://github.com/openai/skills.git",
        category: "Official Directory",
        installs: 120,
        featured: true,
        verification: "official",
        risk: "low",
        facets: [
          { label: "Category", value: "Development" },
          { label: "Team", value: "OpenAI" },
          { label: "Rank", value: "Top 50" },
        ],
        metrics: [
          { label: "Rank", value: "#12" },
          { label: "Repository", value: "openai/skills" },
        ],
      }),
    ];

    const clawskillsSourceSkills: ExternalMarketSkill[] = [
      buildExternalSkill({
        id: "clawskills:openclaw/skills/yazelin/browser",
        marketSource: "clawskills",
        sourceKeys: ["clawskills"],
        name: "browser",
        summary: "来自 clawskills.sh 精选社区目录。",
        source: "openclaw/skills",
        sourceLabel: "yazelin/skills",
        skillId: "yazelin/browser",
        publisher: "yazelin",
        repoUrl: "https://clawskills.sh/skills/yazelin-browser",
        category: "Curated Community",
        installs: 1808,
        featured: true,
        verification: "reviewing",
        risk: "medium",
        facets: [
          { label: "Category", value: "Git & GitHub" },
          { label: "Publisher", value: "yazelin" },
          { label: "Downloads", value: "1k-4.9k" },
        ],
        metrics: [
          { label: "Downloads", value: "1.8k" },
          { label: "Stars", value: "2" },
          { label: "Rank", value: "#25" },
        ],
        detailUrl: "https://clawskills.sh/skills/yazelin-browser",
        packageName: "browser",
        ownerHandle: "yazelin",
      }),
    ];

    const clawhubSourceSkills: ExternalMarketSkill[] = [
      buildExternalSkill({
        id: "clawhub:openclaw/skills/yazelin/browser",
        marketSource: "clawhub",
        sourceKeys: ["clawhub"],
        name: "browser",
        summary: "来自 ClawHub registry。",
        source: "openclaw/skills",
        sourceLabel: "ClawHub",
        skillId: "yazelin/browser",
        publisher: "yazelin",
        repoUrl: "https://clawhub.ai/yazelin/browser",
        category: "General",
        installs: 0,
        featured: false,
        verification: "reviewing",
        risk: "medium",
        facets: [
          { label: "Publisher", value: "yazelin" },
          { label: "Channel", value: "Community" },
          { label: "Capability", value: "General" },
        ],
        metrics: [
          { label: "Execution", value: "No Code Execution" },
          { label: "Version", value: "1.0.0" },
          { label: "Updated", value: "1777105007302" },
        ],
        detailUrl: "https://clawhub.ai/yazelin/browser",
        packageName: "browser",
        packageVersion: "1.0.0",
        ownerHandle: "yazelin",
      }),
    ];

    const skills: Skill[] = [
      {
        id: "skill-local",
        name: "本地技能",
        slug: "local-skill",
        description: "来自本地目录",
        sourceType: "local",
        createdAt: 100,
        updatedAt: 300,
        isArchived: false,
      },
      {
        id: "skill-git",
        name: "仓库技能",
        slug: "git-skill",
        description: "来自仓库快照",
        sourceType: "git_repository",
        createdAt: 120,
        updatedAt: 500,
        isArchived: false,
      },
      {
        id: "skill-installed-external",
        name: "已导入浏览器技能",
        slug: "installed-browser",
        description: "来自外部市场，已在个人技能库内。",
        sourceType: "skillssh",
        createdAt: 140,
        updatedAt: 520,
        isArchived: false,
      },
    ];

    const importHistory: SkillImportRecord[] = [
      {
        id: "record-failed-git",
        sourceType: "git_repository",
        sourceLabel: "仓库快照导入",
        sourceRef: "https://example.com/repo.git",
        requestPayloadJson: JSON.stringify({
          sourceType: "git_repository",
          gitUrl: "https://example.com/repo.git",
          repoSubdir: "skills/git-skill",
        }),
        status: "failed",
        detailMessage: undefined,
        errorMessage: "克隆仓库失败: network timeout",
        createdAt: 600,
        updatedAt: 600,
      },
      {
        id: "record-success-local",
        sourceType: "local",
        sourceLabel: "本地目录导入",
        sourcePath: "D:/skills/local-skill",
        requestPayloadJson: JSON.stringify({
          sourceType: "local",
          folderPath: "D:/skills/local-skill",
        }),
        status: "success",
        targetSkillId: "skill-local",
        targetSkillName: "本地技能",
        detailMessage: "本地目录已导入为「本地技能」，并建立正式来源记录。",
        errorMessage: undefined,
        createdAt: 580,
        updatedAt: 580,
      },
    ];

    Object.assign(skillContextMock, {
      skills,
      loadSkills: vi.fn(),
      selectSkill: vi.fn(),
    });

    getMarketCatalogItemsMock.mockResolvedValue(catalog);
    getExternalMarketSkillsMock.mockImplementation(async (sourceKey: string) => {
      switch (sourceKey) {
        case "officialskills":
          return officialSourceSkills;
        case "clawskills":
          return clawskillsSourceSkills;
        case "clawhub":
          return clawhubSourceSkills;
        case "skillssh":
          return aggregateSkills.filter((item) => item.marketSource === "skillssh");
        default:
          return aggregateSkills;
      }
    });
    getMarketExternalSkillDetailMock.mockResolvedValue({
      id: "skillssh:openai/skills/browser",
      marketSource: "skillssh",
      source: "openai/skills",
      sourceLabel: "skills.sh",
      skillId: "browser",
      name: "browser",
      publisher: "OpenAI",
      repoUrl: "https://github.com/openai/skills.git",
      sourceSubpath: "skills/browser",
      detailUrl: "https://github.com/openai/skills/tree/main/skills/browser",
      summary: "用于浏览器自动化与页面验证。",
      documentationTitle: "Browser",
      documentationPath: "skills/browser/README.md",
      documentationExcerpt: "用于浏览器自动化与页面验证。\n支持页面打开与元素交互。",
      category: "前端开发",
      version: "1.0.0",
      installCommand: "npx skills add https://github.com/openai/skills --skill browser",
      highlights: ["支持页面打开", "支持元素交互"],
      useCases: ["页面验证", "浏览器自动化"],
      requirements: [],
      securitySignals: [],
      packageName: undefined,
      packageVersion: undefined,
      ownerHandle: "openai",
    });
    searchMarketSkillsMock.mockImplementation(async (sourceKey: string) => {
      switch (sourceKey) {
        case "officialskills":
          return officialSourceSkills;
        case "clawskills":
          return clawskillsSourceSkills;
        case "clawhub":
          return clawhubSourceSkills;
        case "skillssh":
          return aggregateSkills.filter((item) => item.marketSource === "skillssh");
        default:
          return aggregateSkills;
      }
    });
    listSkillImportRecordsMock.mockResolvedValue(importHistory);
    importExternalMarketSkillMock.mockResolvedValue({
      id: "skill-external",
      name: "browser",
      slug: "browser",
      description: "来自外部市场",
      sourceType: "skillssh",
      createdAt: 710,
      updatedAt: 710,
      isArchived: false,
    });
    importMarketSkillMock.mockResolvedValue({
      id: "skill-market",
      name: "产品管理模板",
      slug: "market-product",
      description: "来自官方模板",
      sourceType: "market_catalog",
      createdAt: 720,
      updatedAt: 720,
      isArchived: false,
    });
    importSkillMock.mockResolvedValue({
      id: "skill-new-local",
      name: "新本地技能",
      slug: "new-local-skill",
      description: "来自本地目录导入",
      sourceType: "local",
      createdAt: 705,
      updatedAt: 705,
      isArchived: false,
    });
    importSkillFromGitMock.mockResolvedValue({
      id: "skill-retry",
      name: "重试后的仓库技能",
      slug: "retried-git-skill",
      description: "重试成功后的技能",
      sourceType: "git_repository",
      createdAt: 700,
      updatedAt: 700,
      isArchived: false,
    });
    openSkillImportDialogMock.mockResolvedValue(null);
    listSkillSourcesMock.mockImplementation(async (skillId: string): Promise<SkillSource[]> => {
      if (skillId === "skill-local") {
        return [
          {
            id: "source-local",
            skillId,
            sourceType: "local",
            sourceLabel: "本地目录",
            sourcePath: "D:/skills/local-skill",
            isPrimary: true,
            createdAt: 100,
            updatedAt: 100,
          },
        ];
      }

      if (skillId === "skill-installed-external") {
        return [
          {
            id: "source-installed-external",
            skillId,
            sourceType: "skillssh",
            sourceLabel: "外部市场导入",
            sourceRef: "openai/skills/installed-browser",
            metadataJson: JSON.stringify({
              source: "openai/skills",
              skillId: "installed-browser",
              repoUrl: "https://github.com/openai/skills.git",
              sourceSubpath: "skills/installed-browser",
            }),
            isPrimary: true,
            createdAt: 220,
            updatedAt: 220,
          },
        ];
      }

      return [
        {
          id: "source-git",
          skillId,
          sourceType: "git_repository",
          sourceLabel: "仓库快照",
          sourceRef: "https://example.com/repo.git",
          metadataJson: JSON.stringify({ repoSubdir: "skills/git-skill" }),
          isPrimary: true,
          createdAt: 200,
          updatedAt: 200,
        },
      ];
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("默认展示聚合市场骨架、来源栏和统一结果区", async () => {
    renderPage();
    const sourceTabs = screen.getByLabelText("来源切换标签");

    expect(screen.getByText("市场与导入")).toBeTruthy();
    expect(screen.getByRole("button", { name: "导入记录" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "手动导入" })).toBeTruthy();
    expect(within(sourceTabs).getByRole("button", { name: /^全部来源/ })).toBeTruthy();
    expect(within(sourceTabs).getByRole("button", { name: /^skills\.sh/ })).toBeTruthy();
    expect(within(sourceTabs).getByRole("button", { name: /^officialskills\.sh/ })).toBeTruthy();
    expect(within(sourceTabs).getByRole("button", { name: /^clawskills\.sh/ })).toBeTruthy();
    expect(within(sourceTabs).getByRole("button", { name: /ClawHub/ })).toBeTruthy();
    expect(screen.getByPlaceholderText("你想让 skill 帮你做什么？")).toBeTruthy();
    expect(await screen.findAllByText("browser")).toBeTruthy();

    const summary = document.querySelector(".market-page__result-summary");
    expect(summary?.textContent).toContain("全部来源");
    expect(summary?.textContent).toContain("综合推荐");
  });

  it("切换到 live 来源时展示真实控制区和结果，并保留搜索词", async () => {
    renderPage();

    const searchInput = screen.getByPlaceholderText("你想让 skill 帮你做什么？");
    fireEvent.change(searchInput, { target: { value: "browser" } });

    fireEvent.click(screen.getByRole("button", { name: /officialskills\.sh/ }));

    expect(screen.getByDisplayValue("browser")).toBeTruthy();
    expect(searchInput.getAttribute("placeholder")).toBe("按分类、官方团队或技能搜索");
    expect(await screen.findByText("官方目录")).toBeTruthy();
    expect(await screen.findAllByText("browser")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /clawskills\.sh/ }));

    expect(searchInput.getAttribute("placeholder")).toBe("按分类、发布者或技能搜索");
    expect(await screen.findByText("精选社区")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /ClawHub/ }));

    expect(searchInput.getAttribute("placeholder")).toBe("按发布者、能力标签或包搜索");
    expect(await screen.findByText("注册表索引")).toBeTruthy();
  });

  it("导入记录抽屉中可以查看最近记录与最近导入资产，并按主来源筛选", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "导入记录" }));

    expect(await screen.findByText("最近记录")).toBeTruthy();
    expect(screen.getByText("最近导入资产")).toBeTruthy();

    await waitFor(() => {
      expect(listSkillSourcesMock).toHaveBeenCalledWith("skill-local");
      expect(listSkillSourcesMock).toHaveBeenCalledWith("skill-git");
    });

    expect(screen.getByRole("button", { name: /本地技能/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /仓库技能/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /仓库快照\s*1/ }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /本地技能/ })).toBeNull();
    });

    expect(screen.getByRole("button", { name: /仓库技能/ })).toBeTruthy();
  }, 20_000);

  it("可以从导入记录中的最近导入资产直接进入技能资产", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "导入记录" }));

    const governedSkillButton = await screen.findByRole("button", { name: /仓库技能/ });
    fireEvent.click(governedSkillButton);

    expect(skillContextMock.selectSkill).toHaveBeenCalledWith("skill-git");
    expect(mockedNavigate).toHaveBeenCalledWith("/workspace/skill-git");
  }, 10_000);

  it("可以在导入记录抽屉中重试失败记录", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "导入记录" }));

    expect(await screen.findByText("最近记录")).toBeTruthy();
    const failedRecord = screen.getByText("克隆仓库失败: network timeout").closest("article");
    expect(failedRecord).toBeTruthy();

    fireEvent.click(within(failedRecord!).getByRole("button", { name: "重试导入" }));

    await waitFor(() => {
      expect(importSkillFromGitMock).toHaveBeenCalledWith({
        gitUrl: "https://example.com/repo.git",
        repoSubdir: "skills/git-skill",
        displayName: undefined,
      });
    });

    await waitFor(() => {
      expect(skillContextMock.selectSkill).toHaveBeenCalledWith("skill-retry");
      expect(mockedNavigate).toHaveBeenCalledWith("/workspace/skill-retry");
    });
  });

  it("可以从统一结果区导入技能", async () => {
    renderPage();

    const externalCard = await findArticleByText("browser");
    expect(externalCard).toBeTruthy();

    fireEvent.click(within(externalCard!).getByRole("button", { name: /导\s*入/ }));

    await waitFor(() => {
      expect(importExternalMarketSkillMock).toHaveBeenCalledWith({
        marketSource: "officialskills",
        source: "openai/skills",
        skillId: "browser",
        installs: 120,
        packageName: undefined,
        packageVersion: undefined,
        ownerHandle: undefined,
        displayName: "browser",
      });
    });

    await waitFor(() => {
      expect(skillContextMock.selectSkill).toHaveBeenCalledWith("skill-external");
      expect(mockedNavigate).toHaveBeenCalledWith("/workspace/skill-external");
    });
  });

  it("可以打开详情抽屉并展示内容优先的详情结构与文档摘要", async () => {
    renderPage();

    const externalCard = await findArticleByText("browser");
    expect(externalCard).toBeTruthy();

    fireEvent.click(within(externalCard!).getByRole("button", { name: "查看详情" }));

    expect(await screen.findByText("关键信息")).toBeTruthy();
    expect(await screen.findByText("文档摘要")).toBeTruthy();
    expect(await screen.findAllByText(/用于浏览器自动化与页面验证/)).toBeTruthy();
    expect(await screen.findByText("支持页面打开与元素交互。")).toBeTruthy();
    expect(getMarketExternalSkillDetailMock).toHaveBeenCalledWith(
      "officialskills",
      "openai/skills",
      "browser",
      undefined,
      undefined,
    );
  });

  it("已导入的外部技能资产可直接打开资产", async () => {
    renderPage();

    const installedCard = await findArticleByText("installed-browser");
    expect(installedCard).toBeTruthy();
    expect(within(installedCard!).getByText("已在个人技能库中，当前名称为「已导入浏览器技能」。")).toBeTruthy();

    fireEvent.click(within(installedCard!).getByRole("button", { name: "打开资产" }));

    expect(importExternalMarketSkillMock).not.toHaveBeenCalled();
    expect(skillContextMock.selectSkill).toHaveBeenCalledWith("skill-installed-external");
    expect(mockedNavigate).toHaveBeenCalledWith("/workspace/skill-installed-external");
  });

  it("外部技能资产与现有 slug 冲突时可直接查看已有资产", async () => {
    renderPage();

    const conflictCard = await findArticleByText("git skill");
    expect(conflictCard).toBeTruthy();
    expect(within(conflictCard!).getByText("标识 git-skill 已被现有技能资产「仓库技能」占用。")).toBeTruthy();

    fireEvent.click(within(conflictCard!).getByRole("button", { name: "查看已有资产" }));

    expect(importExternalMarketSkillMock).not.toHaveBeenCalled();
    expect(skillContextMock.selectSkill).toHaveBeenCalledWith("skill-git");
    expect(mockedNavigate).toHaveBeenCalledWith("/workspace/skill-git");
  });

  it("手动导入抽屉可执行 Git 仓库导入，并显示边界迁移提示", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "手动导入" }));

    const gitUrlInput = await screen.findByPlaceholderText("输入 Git 仓库地址");
    expect(screen.getAllByText("本地目录").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "选择目录" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "从仓库导入" })).toBeTruthy();

    fireEvent.change(gitUrlInput, { target: { value: "https://github.com/example/skills.git" } });
    fireEvent.change(screen.getByPlaceholderText("可选：仓库内技能子目录"), {
      target: { value: "skills/browser" },
    });

    fireEvent.click(screen.getByRole("button", { name: "从仓库导入" }));

    await waitFor(() => {
      expect(importSkillFromGitMock).toHaveBeenCalledWith({
        gitUrl: "https://github.com/example/skills.git",
        repoSubdir: "skills/browser",
      });
    });

    await waitFor(() => {
      expect(skillContextMock.selectSkill).toHaveBeenCalledWith("skill-retry");
      expect(mockedNavigate).toHaveBeenCalledWith("/workspace/skill-retry");
    });
  });

  it("手动导入抽屉可执行本地目录导入", async () => {
    openSkillImportDialogMock.mockResolvedValueOnce("D:/skills/new-local-skill");
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "手动导入" }));
    fireEvent.click(await screen.findByRole("button", { name: "选择目录" }));

    await waitFor(() => {
      expect(importSkillMock).toHaveBeenCalledWith({
        folderPath: "D:/skills/new-local-skill",
      });
    });

    await waitFor(() => {
      expect(skillContextMock.selectSkill).toHaveBeenCalledWith("skill-new-local");
      expect(mockedNavigate).toHaveBeenCalledWith("/workspace/skill-new-local");
    });
  });

  it("导入失败时会把 slug 冲突翻译为更明确的提示", async () => {
    importExternalMarketSkillMock.mockRejectedValueOnce(new Error("slug 'git-skill' 已存在"));
    renderPage();

    const externalCard = await findArticleByText("browser");
    expect(externalCard).toBeTruthy();

    fireEvent.click(within(externalCard!).getByRole("button", { name: /导\s*入/ }));

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalled();
    });

    const latestErrorCall = messageErrorMock.mock.calls[messageErrorMock.mock.calls.length - 1];
    expect(latestErrorCall?.[0]).toContain("它已被技能资产「仓库技能」占用");
  });

  it("英文界面显示新的市场、来源和 live 来源控制区", async () => {
    i18nState.language = "en-US";
    i18nState.resolvedLanguage = "en-US";

    renderPage();
    const sourceTabs = screen.getByLabelText("Market Source Tabs");

    expect(screen.getByText("Market & Import")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import Records" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manual Import" })).toBeTruthy();
    expect(within(sourceTabs).getByRole("button", { name: /^All Sources/ })).toBeTruthy();
    expect(within(sourceTabs).getByRole("button", { name: /^skills\.sh/ })).toBeTruthy();
    expect(screen.getByPlaceholderText("What do you want this skill to help with?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /officialskills\.sh/ }));

    expect(await screen.findAllByText("browser")).toBeTruthy();
    expect(screen.queryByLabelText("Category")).toBeNull();
    expect(screen.queryByLabelText("Team")).toBeNull();
    expect(screen.queryByLabelText("Rank")).toBeNull();
  }, 10_000);
});
