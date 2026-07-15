import Button from "antd/es/button";
import { useI18n } from "@/features/settings/state/I18nContext";
import { VersionCompareResults } from "@/shared/components/VersionCompareResults";
import type { SnapshotDiffResult } from "@/types/skill";

interface CompareModeShellProps {
  labelA: string;
  labelB: string;
  hasChanges: boolean;
  diffResult: SnapshotDiffResult | null;
  diffLoading: boolean;
  selectedFile: string | null;
  diffMode: "unified" | "split";
  onSelectFile: (file: string) => void;
  onDiffModeChange: (mode: "unified" | "split") => void;
  onBack: () => void;
  onCompareWorkspace: () => void;
}

export function CompareModeShell({
  labelA,
  labelB,
  hasChanges,
  diffResult,
  diffLoading,
  selectedFile,
  diffMode,
  onSelectFile,
  onDiffModeChange,
  onBack,
  onCompareWorkspace,
}: CompareModeShellProps) {
  const { resolvedLanguage } = useI18n();
  const copy = resolvedLanguage === "en-US"
    ? {
        back: "Back to Versions",
        base: "Base Version",
        target: "Compare Version",
        compareWorkspace: "Compare Workspace",
      }
    : {
        back: "返回版本列表",
        base: "基线版本",
        target: "对比版本",
        compareWorkspace: "对比工作区",
      };
  return (
    <section className="compare-mode-shell compare-mode-shell--dense">
      <div className="compare-mode-shell__toolbar">
        <div className="compare-mode-shell__toolbar-main">
          <Button type="link" className="compare-mode-shell__back" onClick={onBack}>
            {copy.back}
          </Button>

          <div className="compare-mode-shell__labels">
            <span className="compare-mode-shell__label">
              <small>{copy.base}</small>
              <strong>{labelA}</strong>
            </span>
            <span className="compare-mode-shell__label">
              <small>{copy.target}</small>
              <strong>{labelB}</strong>
            </span>
          </div>
        </div>

        {hasChanges ? (
          <Button size="small" type="primary" ghost onClick={onCompareWorkspace}>
            {copy.compareWorkspace}
          </Button>
        ) : null}
      </div>

      <div className="compare-mode-shell__content">
        <VersionCompareResults
          diffResult={diffResult}
          diffLoading={diffLoading}
          selectedFile={selectedFile}
          diffMode={diffMode}
          onSelectFile={onSelectFile}
          onDiffModeChange={onDiffModeChange}
          language={resolvedLanguage}
        />
      </div>
    </section>
  );
}
