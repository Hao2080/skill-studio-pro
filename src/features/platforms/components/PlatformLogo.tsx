import type { CSSProperties, ReactNode } from "react";

type PlatformLogoPattern = "orbit" | "grid" | "spark" | "beam" | "wave" | "node";

interface PlatformBrandDefinition {
  accent: string;
  accentSoft: string;
  ink: string;
  mark: string;
  pattern: PlatformLogoPattern;
}

const PLATFORM_LOGO_ASSETS: Record<string, string> = {
  cursor: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/cursor.svg",
    import.meta.url,
  ).href,
  claude: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/claudecode-color.svg",
    import.meta.url,
  ).href,
  codex: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/codex-color.svg",
    import.meta.url,
  ).href,
  opencode: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/opencode.svg",
    import.meta.url,
  ).href,
  antigravity: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/antigravity-color.svg",
    import.meta.url,
  ).href,
  amp: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/amp-color.svg",
    import.meta.url,
  ).href,
  kilo_code: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/kilocode.svg",
    import.meta.url,
  ).href,
  roo_code: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/roocode.svg",
    import.meta.url,
  ).href,
  goose: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/goose.svg",
    import.meta.url,
  ).href,
  gemini: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/geminicli-color.svg",
    import.meta.url,
  ).href,
  github_copilot: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/githubcopilot.svg",
    import.meta.url,
  ).href,
  openclaw: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/openclaw-color.svg",
    import.meta.url,
  ).href,
  droid: new URL("../assets/logos/droid.svg", import.meta.url).href,
  windsurf: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/windsurf.svg",
    import.meta.url,
  ).href,
  trae: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/trae-color.svg",
    import.meta.url,
  ).href,
  cline: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/cline.svg",
    import.meta.url,
  ).href,
  deepagents: new URL("../assets/logos/deepagents.svg", import.meta.url).href,
  firebender: new URL("../assets/logos/firebender.png", import.meta.url).href,
  kimi: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/kimi-color.svg",
    import.meta.url,
  ).href,
  replit: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/replit-color.svg",
    import.meta.url,
  ).href,
  warp: new URL("../../../../node_modules/simple-icons/icons/warp.svg", import.meta.url).href,
  augment: new URL("../assets/logos/augment.svg", import.meta.url).href,
  bob: new URL("../../../../node_modules/@lobehub/icons-static-svg/icons/ibm.svg", import.meta.url)
    .href,
  codebuddy: new URL("../assets/logos/codebuddy.svg", import.meta.url).href,
  command_code: new URL("../assets/logos/command-code.png", import.meta.url).href,
  continue: new URL("../assets/logos/continue.png", import.meta.url).href,
  cortex: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/snowflake-color.svg",
    import.meta.url,
  ).href,
  crush: new URL("../assets/logos/crush.png", import.meta.url).href,
  iflow: new URL("../assets/logos/iflow.png", import.meta.url).href,
  junie: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/junie-color.svg",
    import.meta.url,
  ).href,
  kiro: new URL("../assets/logos/kiro.svg", import.meta.url).href,
  mcpjam: new URL("../assets/logos/mcpjam.png", import.meta.url).href,
  mistral_vibe: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/mistral-color.svg",
    import.meta.url,
  ).href,
  mux: new URL("../assets/logos/mux.svg", import.meta.url).href,
  neovate: new URL("../assets/logos/neovate.jpg", import.meta.url).href,
  openhands: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/openhands-color.svg",
    import.meta.url,
  ).href,
  pochi: new URL("../assets/logos/pochi.png", import.meta.url).href,
  qoder: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/qoder-color.svg",
    import.meta.url,
  ).href,
  qwen_code: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/qwen-color.svg",
    import.meta.url,
  ).href,
  trae_cn: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/trae-color.svg",
    import.meta.url,
  ).href,
  zencoder: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/zencoder-color.svg",
    import.meta.url,
  ).href,
  adal: new URL("../assets/logos/adal.svg", import.meta.url).href,
  hermes: new URL(
    "../../../../node_modules/@lobehub/icons-static-svg/icons/hermesagent.svg",
    import.meta.url,
  ).href,
};

const PLATFORM_BRAND_DEFINITIONS: Record<string, PlatformBrandDefinition> = {
  cursor: { accent: "#2563eb", accentSoft: "#eaf2ff", ink: "#12306b", mark: "CS", pattern: "beam" },
  claude: { accent: "#d97706", accentSoft: "#fff3df", ink: "#8a4b08", mark: "CC", pattern: "orbit" },
  codex: { accent: "#111827", accentSoft: "#eef2ff", ink: "#111827", mark: "CX", pattern: "grid" },
  opencode: { accent: "#0f766e", accentSoft: "#e6fffa", ink: "#115e59", mark: "OC", pattern: "wave" },
  antigravity: { accent: "#7c3aed", accentSoft: "#f5edff", ink: "#5b21b6", mark: "AG", pattern: "orbit" },
  amp: { accent: "#0891b2", accentSoft: "#e8fbff", ink: "#155e75", mark: "AP", pattern: "beam" },
  kilo_code: { accent: "#1d4ed8", accentSoft: "#edf4ff", ink: "#1e3a8a", mark: "KC", pattern: "grid" },
  roo_code: { accent: "#2563eb", accentSoft: "#eff6ff", ink: "#1d4ed8", mark: "RC", pattern: "node" },
  goose: { accent: "#16a34a", accentSoft: "#ebfff0", ink: "#166534", mark: "GS", pattern: "wave" },
  gemini: { accent: "#4f46e5", accentSoft: "#eef0ff", ink: "#3730a3", mark: "GM", pattern: "spark" },
  github_copilot: { accent: "#0f172a", accentSoft: "#eef2f7", ink: "#111827", mark: "GH", pattern: "node" },
  openclaw: { accent: "#0f766e", accentSoft: "#e8fffb", ink: "#115e59", mark: "CL", pattern: "beam" },
  droid: { accent: "#22c55e", accentSoft: "#ecfff1", ink: "#166534", mark: "DR", pattern: "node" },
  windsurf: { accent: "#0284c7", accentSoft: "#e8f8ff", ink: "#0c4a6e", mark: "WS", pattern: "wave" },
  trae: { accent: "#2563eb", accentSoft: "#edf5ff", ink: "#1e3a8a", mark: "TR", pattern: "beam" },
  cline: { accent: "#1d4ed8", accentSoft: "#edf4ff", ink: "#1e3a8a", mark: "CL", pattern: "grid" },
  deepagents: { accent: "#4338ca", accentSoft: "#efeeff", ink: "#3730a3", mark: "DA", pattern: "node" },
  firebender: { accent: "#dc2626", accentSoft: "#fff0f0", ink: "#991b1b", mark: "FB", pattern: "spark" },
  kimi: { accent: "#ea580c", accentSoft: "#fff2e8", ink: "#9a3412", mark: "KM", pattern: "spark" },
  replit: { accent: "#f97316", accentSoft: "#fff2e9", ink: "#9a3412", mark: "RP", pattern: "beam" },
  warp: { accent: "#7c3aed", accentSoft: "#f3ebff", ink: "#5b21b6", mark: "WP", pattern: "orbit" },
  augment: { accent: "#0f766e", accentSoft: "#e8fffb", ink: "#134e4a", mark: "AU", pattern: "grid" },
  bob: { accent: "#1d4ed8", accentSoft: "#edf4ff", ink: "#1e3a8a", mark: "IB", pattern: "node" },
  codebuddy: { accent: "#2563eb", accentSoft: "#eff6ff", ink: "#1d4ed8", mark: "CB", pattern: "orbit" },
  command_code: { accent: "#0f172a", accentSoft: "#eef2f7", ink: "#111827", mark: "CM", pattern: "beam" },
  continue: { accent: "#0f766e", accentSoft: "#e7fffb", ink: "#115e59", mark: "CT", pattern: "wave" },
  cortex: { accent: "#0f766e", accentSoft: "#e7fefa", ink: "#115e59", mark: "CX", pattern: "node" },
  crush: { accent: "#db2777", accentSoft: "#fff0f7", ink: "#9d174d", mark: "CR", pattern: "spark" },
  iflow: { accent: "#2563eb", accentSoft: "#edf4ff", ink: "#1e3a8a", mark: "IF", pattern: "wave" },
  junie: { accent: "#8b5cf6", accentSoft: "#f5efff", ink: "#6d28d9", mark: "JU", pattern: "spark" },
  kiro: { accent: "#0891b2", accentSoft: "#ebfbff", ink: "#155e75", mark: "KI", pattern: "beam" },
  kode: { accent: "#2563eb", accentSoft: "#edf5ff", ink: "#1d4ed8", mark: "KD", pattern: "grid" },
  mcpjam: { accent: "#9333ea", accentSoft: "#f8efff", ink: "#6b21a8", mark: "MJ", pattern: "node" },
  mistral_vibe: { accent: "#7c3aed", accentSoft: "#f5edff", ink: "#5b21b6", mark: "MV", pattern: "wave" },
  mux: { accent: "#0f766e", accentSoft: "#e9fffb", ink: "#134e4a", mark: "MX", pattern: "grid" },
  neovate: { accent: "#2563eb", accentSoft: "#edf5ff", ink: "#1d4ed8", mark: "NV", pattern: "orbit" },
  openhands: { accent: "#0f766e", accentSoft: "#e7fffb", ink: "#115e59", mark: "OH", pattern: "node" },
  pi: { accent: "#f59e0b", accentSoft: "#fff5df", ink: "#92400e", mark: "PI", pattern: "spark" },
  pochi: { accent: "#ec4899", accentSoft: "#fff0f8", ink: "#9d174d", mark: "PC", pattern: "orbit" },
  qoder: { accent: "#1d4ed8", accentSoft: "#edf4ff", ink: "#1e3a8a", mark: "QD", pattern: "beam" },
  qwen_code: { accent: "#2563eb", accentSoft: "#edf4ff", ink: "#1e3a8a", mark: "QW", pattern: "wave" },
  trae_cn: { accent: "#0f766e", accentSoft: "#e8fffb", ink: "#115e59", mark: "TC", pattern: "beam" },
  zencoder: { accent: "#059669", accentSoft: "#e9fff5", ink: "#065f46", mark: "ZE", pattern: "grid" },
  adal: { accent: "#2563eb", accentSoft: "#edf5ff", ink: "#1d4ed8", mark: "AD", pattern: "node" },
  hermes: { accent: "#7c3aed", accentSoft: "#f4ecff", ink: "#5b21b6", mark: "HM", pattern: "beam" },
};

const FALLBACK_PATTERNS: PlatformLogoPattern[] = ["orbit", "grid", "spark", "beam", "wave", "node"];

function hashValue(input: string) {
  return Array.from(input).reduce((accumulator, char) => accumulator * 31 + char.charCodeAt(0), 7);
}

function buildFallbackMark(displayName: string, platformName: string) {
  const words = displayName
    .trim()
    .split(/[\s/_-]+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }

  const compactName = platformName.replace(/[^a-z0-9]/gi, "");
  return compactName.slice(0, 2).toUpperCase() || "AG";
}

function buildFallbackDefinition(platformName: string, displayName: string): PlatformBrandDefinition {
  const seed = Math.abs(hashValue(platformName));
  const hue = seed % 360;

  return {
    accent: `hsl(${hue} 70% 48%)`,
    accentSoft: `hsl(${hue} 100% 96%)`,
    ink: `hsl(${hue} 48% 24%)`,
    mark: buildFallbackMark(displayName, platformName),
    pattern: FALLBACK_PATTERNS[seed % FALLBACK_PATTERNS.length],
  };
}

function getPlatformBrandDefinition(platformName: string, displayName: string) {
  return PLATFORM_BRAND_DEFINITIONS[platformName] ?? buildFallbackDefinition(platformName, displayName);
}

function renderPattern(pattern: PlatformLogoPattern): ReactNode {
  switch (pattern) {
    case "orbit":
      return (
        <>
          <circle cx="40" cy="16" r="7" stroke="currentColor" strokeWidth="3" />
          <circle cx="17" cy="39" r="8" fill="currentColor" opacity="0.2" />
          <path d="M13 31C18 18 30 11 43 13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case "grid":
      return (
        <>
          <rect x="14" y="13" width="10" height="10" rx="3" fill="currentColor" opacity="0.34" />
          <rect x="30" y="13" width="12" height="12" rx="4" stroke="currentColor" strokeWidth="3" />
          <rect x="14" y="29" width="12" height="12" rx="4" stroke="currentColor" strokeWidth="3" />
          <rect x="31" y="30" width="11" height="11" rx="3" fill="currentColor" />
        </>
      );
    case "spark":
      return (
        <>
          <path d="M28 10L31.5 22.5L44 26L31.5 29.5L28 42L24.5 29.5L12 26L24.5 22.5L28 10Z" fill="currentColor" opacity="0.24" />
          <path d="M28 16L30.4 23.6L38 26L30.4 28.4L28 36L25.6 28.4L18 26L25.6 23.6L28 16Z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
        </>
      );
    case "beam":
      return (
        <>
          <path d="M17 40L39 14" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M20 18H42" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
          <path d="M14 34H30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case "wave":
      return (
        <>
          <path d="M12 20C16 16 20 16 24 20C28 24 32 24 36 20C40 16 44 16 44 16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M12 29C16 25 20 25 24 29C28 33 32 33 36 29C40 25 44 25 44 25" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
          <path d="M12 38C16 34 20 34 24 38C28 42 32 42 36 38C40 34 44 34 44 34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.52" />
        </>
      );
    case "node":
      return (
        <>
          <circle cx="19" cy="18" r="5" fill="currentColor" opacity="0.32" />
          <circle cx="37" cy="17" r="5" stroke="currentColor" strokeWidth="3" />
          <circle cx="28" cy="35" r="7" fill="currentColor" />
          <path d="M22.5 21.5L26 29" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M33.5 20.5L30 29" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    default:
      return null;
  }
}

export function PlatformLogo({
  platformName,
  displayName,
}: {
  platformName: string;
  displayName: string;
}) {
  const logoAsset = PLATFORM_LOGO_ASSETS[platformName];

  if (logoAsset) {
    const assetClassName = `platform-logo--asset-${platformName.replace(/_/g, "-")}`;

    return (
      <div className={`platform-logo platform-logo--asset ${assetClassName}`} aria-hidden="true">
        <img
          className="platform-logo__image"
          src={logoAsset}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </div>
    );
  }

  const brand = getPlatformBrandDefinition(platformName, displayName);
  const style = {
    "--platform-logo-accent": brand.accent,
    "--platform-logo-accent-soft": brand.accentSoft,
    "--platform-logo-ink": brand.ink,
  } as CSSProperties;

  return (
    <div className={`platform-logo platform-logo--${brand.pattern}`} style={style} aria-hidden="true">
      <svg className="platform-logo__art" viewBox="0 0 56 56" fill="none">
        {renderPattern(brand.pattern)}
      </svg>
      <span className="platform-logo__mark">{brand.mark}</span>
    </div>
  );
}
