import { describe, expect, it } from "vitest";
import tauriConfig from "../../../src-tauri/tauri.conf.json";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readStylesheet = (name: string) => readFileSync(resolve(process.cwd(), "src", "styles", name), "utf8");
const layoutCss = readStylesheet("layout.css");
const proThemeCss = readStylesheet("pro-theme.css");
const tokensCss = readStylesheet("tokens.css");
const platformStore = readFileSync(resolve(process.cwd(), "src-tauri", "src", "store", "platform.rs"), "utf8");

describe("desktop window and accessibility CSS contract", () => {
  it("keeps the supported and default desktop viewport sizes explicit", () => {
    const window = tauriConfig.app.windows[0];
    expect(window).toEqual(expect.objectContaining({
      width: 1280,
      height: 800,
      minWidth: 900,
      minHeight: 600,
    }));
  });

  it("preserves responsive structure, visible focus, and reduced effects", () => {
    expect(layoutCss).toContain("@media (max-width: 900px)");
    expect(layoutCss).toContain(".app-shell__content");
    expect(layoutCss).toMatch(/overflow\s*:\s*hidden/);
    expect(proThemeCss).toContain("@media (max-width: 1100px)");
    expect(tokensCss).toContain("*:focus-visible");
    expect(tokensCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(tokensCss).toContain(':root[data-reduce-motion="true"]');
    expect(tokensCss).toContain(':root[data-reduce-transparency="true"]');
    expect(tokensCss).toMatch(/--pro-blur-strength\s*:\s*0px/);
  });

  it("resolves platform paths through the isolated application home", () => {
    expect(platformStore).not.toMatch(/\.path\(\)\s*\.home_dir\(\)/);
    expect(platformStore.match(/workspace::home_dir\(\)/g)).toHaveLength(2);
  });
});
