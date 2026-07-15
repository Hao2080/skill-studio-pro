import { PlatformsPage } from "./PlatformsPage";
import { ScanRootsPanel } from "@/features/inventory/components/ScanRootsPanel";
import { pickPlatformDirectory } from "../api/platformsApi";
import "../pro-styles.css";

export function ProPlatformsPage() {
  return (
    <div className="pro-page platforms-pro-page">
      <div className="pro-page__inner">
        <PlatformsPage />
        <p className="platform-footnote">复制为默认模式。Windows 或目标平台不支持符号链接时会明确显示能力限制，不会静默改成复制。</p>
        <ScanRootsPanel pickDirectory={pickPlatformDirectory} />
      </div>
    </div>
  );
}
