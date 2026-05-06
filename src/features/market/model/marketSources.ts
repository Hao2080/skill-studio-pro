import type {
  MarketRiskLevel,
  MarketSourceDescriptor,
  MarketSourceKey,
  MarketVerificationState,
  UiLanguage,
} from "./marketTypes";

function buildRegistry(language: UiLanguage): MarketSourceDescriptor[] {
  if (language === "en-US") {
    return [
      {
        key: "all",
        label: "All Sources",
        summary: "Start from goals, compare results in one list, then switch into each source without losing context.",
        availability: "live",
        verification: "verified",
        risk: "low",
        filterPreview: ["Capabilities", "Source", "Install State", "Verification", "Platforms"],
        emptyTitle: "No matching skills in the aggregate view",
        emptyDescription: "Adjust the goal or filters and continue browsing.",
      },
      {
        key: "skillssh",
        label: "skills.sh",
        summary: "Browse skills.sh by leaderboard, repository, and special topics such as Security Audits and Office.",
        availability: "live",
        verification: "verified",
        risk: "low",
        filterPreview: ["Board", "Source Repository", "Native Category", "Security Audits", "Office"],
        emptyTitle: "No matching skills in skills.sh",
        emptyDescription: "Try another board, repository, category, or topic.",
      },
      {
        key: "officialskills",
        label: "officialskills.sh",
        summary: "Browse the official directory by category, team, and ranking signals.",
        availability: "live",
        verification: "official",
        risk: "low",
        filterPreview: ["Category", "Team", "Rank"],
        emptyTitle: "No matching skills in officialskills.sh",
        emptyDescription: "Adjust category, team, rank, or install state and continue browsing.",
      },
      {
        key: "clawskills",
        label: "clawskills.sh",
        summary: "Browse curated community skills by source category, publisher, and download bands.",
        availability: "live",
        verification: "reviewing",
        risk: "medium",
        filterPreview: ["Category", "Publisher", "Downloads"],
        emptyTitle: "No matching skills in clawskills.sh",
        emptyDescription: "Adjust category, publisher, downloads, or install state and continue browsing.",
      },
      {
        key: "clawhub",
        label: "ClawHub",
        summary: "Browse the registry by publisher, channel, and capability tags.",
        availability: "live",
        verification: "reviewing",
        risk: "medium",
        filterPreview: ["Publisher", "Channel", "Capability", "Execution", "Updated"],
        emptyTitle: "No matching skills in ClawHub",
        emptyDescription: "Adjust publisher, channel, capability, or install state and continue browsing.",
      },
    ];
  }

  return [
    {
      key: "all",
      label: "全部来源",
      summary: "先按目标搜索，再在统一结果里比较，最后切换到单来源按原生方式继续深挖。",
      availability: "live",
      verification: "verified",
      risk: "low",
      filterPreview: ["能力标签", "来源", "安装状态", "验证状态", "适配平台"],
      emptyTitle: "当前聚合视图下没有匹配结果",
      emptyDescription: "调整关键词或筛选条件后继续检索。",
    },
    {
      key: "skillssh",
      label: "skills.sh",
      summary: "保留榜单、来源仓库和专题入口，让你按 skills.sh 的方式继续浏览成熟社区技能资产。",
      availability: "live",
      verification: "verified",
      risk: "low",
      filterPreview: ["榜单", "来源仓库", "原始分类", "安全审计", "办公效率"],
      emptyTitle: "skills.sh 当前没有匹配结果",
      emptyDescription: "切换榜单、仓库、分类或专题后继续检索。",
    },
    {
      key: "officialskills",
      label: "officialskills.sh",
      summary: "以官方目录为核心，按分类、团队和榜位信号浏览官方技能来源。",
      availability: "live",
      verification: "official",
      risk: "low",
      filterPreview: ["分类", "团队", "榜位"],
      emptyTitle: "officialskills.sh 当前没有匹配结果",
      emptyDescription: "调整分类、团队、榜位或安装状态后继续检索。",
    },
    {
      key: "clawskills",
      label: "clawskills.sh",
      summary: "按源分类、发布者和下载带宽浏览精选社区技能，保留 clawskills 的发现逻辑。",
      availability: "live",
      verification: "reviewing",
      risk: "medium",
      filterPreview: ["分类", "发布者", "下载量"],
      emptyTitle: "clawskills.sh 当前没有匹配结果",
      emptyDescription: "调整分类、发布者、下载量或安装状态后继续检索。",
    },
    {
      key: "clawhub",
      label: "ClawHub",
      summary: "按发布者、来源频道和能力类型浏览注册表原始包信息，突出源原生元数据。",
      availability: "live",
      verification: "reviewing",
      risk: "medium",
      filterPreview: ["发布者", "来源频道", "能力类型", "执行方式", "最近更新"],
      emptyTitle: "ClawHub 当前没有匹配结果",
      emptyDescription: "调整发布者、来源频道、能力类型或安装状态后继续检索。",
    },
  ];
}

export function getMarketSourceRegistry(language: UiLanguage) {
  return buildRegistry(language);
}

export function getMarketSourceDescriptor(key: MarketSourceKey, language: UiLanguage) {
  return buildRegistry(language).find((item) => item.key === key) ?? buildRegistry(language)[0];
}

export function getMarketVerificationLabel(value: MarketVerificationState, language: UiLanguage) {
  if (language === "en-US") {
    switch (value) {
      case "official":
        return "Official";
      case "reviewing":
        return "Under Review";
      case "unverified":
        return "Unverified";
      default:
        return "Verified";
    }
  }

  switch (value) {
    case "official":
      return "官方来源";
    case "reviewing":
      return "审核中";
    case "unverified":
      return "未验证来源";
    default:
      return "已验证来源";
  }
}

export function getMarketRiskLabel(value: MarketRiskLevel, language: UiLanguage) {
  if (language === "en-US") {
    switch (value) {
      case "high":
        return "High Risk";
      case "medium":
        return "Medium Risk";
      default:
        return "Low Risk";
    }
  }

  switch (value) {
    case "high":
      return "高风险";
    case "medium":
      return "中风险";
    default:
      return "低风险";
  }
}
