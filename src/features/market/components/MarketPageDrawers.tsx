import Drawer from "antd/es/drawer";
import type { ChangeEvent } from "react";
import type { SkillImportRecord } from "@/types/skill";
import type { MarketCopy } from "../model/marketCopy";
import type {
  GovernanceSourceItem,
  ImportMode,
  ImportProgressState,
  UiLanguage,
} from "../model/marketTypes";
import { MarketGitIntakePanel } from "./MarketGitIntakePanel";
import { MarketGovernanceSection } from "./MarketGovernanceSection";
import { MarketImportHistorySection } from "./MarketImportHistorySection";
import { MarketImportStatusPanel } from "./MarketImportStatusPanel";
import { MarketLocalIntakePanel } from "./MarketLocalIntakePanel";

interface MarketImportStatusBlockProps {
  copy: MarketCopy;
  importProgress: ImportProgressState | null;
  busyImport: ImportMode;
  currentImportStepIndex: number;
}

function MarketImportStatusBlock({
  copy,
  importProgress,
  busyImport,
  currentImportStepIndex,
}: MarketImportStatusBlockProps) {
  return (
    <MarketImportStatusPanel
      copy={copy}
      importProgress={importProgress}
      isBusy={busyImport !== null}
      currentImportStepIndex={currentImportStepIndex}
    />
  );
}

interface MarketManualIntakeDrawerProps {
  open: boolean;
  title: string;
  copy: MarketCopy;
  isEnglish: boolean;
  busyImport: ImportMode;
  importProgress: ImportProgressState | null;
  currentImportStepIndex: number;
  gitUrl: string;
  gitSubdir: string;
  onClose: () => void;
  onGitUrlChange: (value: string) => void;
  onGitSubdirChange: (value: string) => void;
  onLocalImport: () => void;
  onGitImport: () => void;
}

export function MarketManualIntakeDrawer({
  open,
  title,
  copy,
  isEnglish,
  busyImport,
  importProgress,
  currentImportStepIndex,
  gitUrl,
  gitSubdir,
  onClose,
  onGitUrlChange,
  onGitSubdirChange,
  onLocalImport,
  onGitImport,
}: MarketManualIntakeDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      width={620}
      className="market-page__manual-drawer"
    >
      <div className="market-page__manual-layout market-page__manual-layout--console">
        <section className="market-page__manual-stack">
          <MarketLocalIntakePanel
            copy={copy}
            busy={busyImport === "local"}
            onImport={onLocalImport}
          />

          <MarketGitIntakePanel
            copy={copy}
            gitUrl={gitUrl}
            gitSubdir={gitSubdir}
            gitAddressLabel={isEnglish ? "Repository Address" : "仓库地址"}
            gitSubdirLabel={isEnglish ? "Skill Subdirectory" : "技能子目录"}
            gitSubdirStatus={isEnglish ? "Optional" : "可选"}
            busy={busyImport === "git"}
            onGitUrlChange={(event: ChangeEvent<HTMLInputElement>) => onGitUrlChange(event.target.value)}
            onGitSubdirChange={(event: ChangeEvent<HTMLInputElement>) => onGitSubdirChange(event.target.value)}
            onImport={onGitImport}
          />
        </section>

        {importProgress ? (
          <MarketImportStatusBlock
            copy={copy}
            importProgress={importProgress}
            busyImport={busyImport}
            currentImportStepIndex={currentImportStepIndex}
          />
        ) : null}
      </div>
    </Drawer>
  );
}

interface MarketActivityDrawerProps {
  open: boolean;
  title: string;
  copy: MarketCopy;
  language: UiLanguage;
  activityHistoryLabel: string;
  recentAssetsLabel: string;
  busyImport: ImportMode;
  importProgress: ImportProgressState | null;
  currentImportStepIndex: number;
  historyLoading: boolean;
  historyError: string | null;
  importHistory: SkillImportRecord[];
  sourceFilters: Array<{ value: string; label: string; count: number }>;
  selectedSourceType: string;
  sourceItems: GovernanceSourceItem[];
  filteredSourceItems: GovernanceSourceItem[];
  onClose: () => void;
  onReloadHistory: () => void;
  onRetryImport: (record: SkillImportRecord) => void;
  onOpenSkill: (skillId: string) => void;
  onSourceTypeChange: (value: string) => void;
}

export function MarketActivityDrawer({
  open,
  title,
  copy,
  language,
  activityHistoryLabel,
  recentAssetsLabel,
  busyImport,
  importProgress,
  currentImportStepIndex,
  historyLoading,
  historyError,
  importHistory,
  sourceFilters,
  selectedSourceType,
  sourceItems,
  filteredSourceItems,
  onClose,
  onReloadHistory,
  onRetryImport,
  onOpenSkill,
  onSourceTypeChange,
}: MarketActivityDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      width={560}
      className="market-page__activity-drawer"
    >
      <div className="market-page__activity-layout market-page__activity-layout--console">
        <MarketImportStatusBlock
          copy={copy}
          importProgress={importProgress}
          busyImport={busyImport}
          currentImportStepIndex={currentImportStepIndex}
        />

        <MarketImportHistorySection
          copy={copy}
          language={language}
          title={activityHistoryLabel}
          busyImport={busyImport}
          historyLoading={historyLoading}
          historyError={historyError}
          importHistory={importHistory}
          onReload={onReloadHistory}
          onRetryImport={onRetryImport}
          onOpenSkill={onOpenSkill}
        />

        <MarketGovernanceSection
          copy={copy}
          language={language}
          title={recentAssetsLabel}
          sourceFilters={sourceFilters}
          selectedSourceType={selectedSourceType}
          sourceItems={sourceItems}
          filteredSourceItems={filteredSourceItems}
          onSourceTypeChange={onSourceTypeChange}
          onOpenSkill={onOpenSkill}
        />
      </div>
    </Drawer>
  );
}
