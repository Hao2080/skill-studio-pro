import { useEffect, useMemo, useState, type ReactNode } from "react";
import App from "antd/es/app";
import Alert from "antd/es/alert";
import Button from "antd/es/button";
import Dropdown from "antd/es/dropdown";
import Empty from "antd/es/empty";
import Input from "antd/es/input";
import Modal from "antd/es/modal";
import Segmented from "antd/es/segmented";
import Select from "antd/es/select";
import Switch from "antd/es/switch";
import Typography from "antd/es/typography";
import { MoreHorizontal } from "lucide-react";
import type {
  CreateCustomPlatformInput,
  PlatformConnection,
  PlatformGovernanceImpact,
} from "@/types/skill";
import { useI18n } from "@/features/settings/state/I18nContext";
import { PlatformLogo } from "../components/PlatformLogo";
import {
  createCustomPlatform,
  deleteCustomPlatform,
  getPlatformGovernanceImpact,
  listPlatformConnections,
  pickPlatformDirectory,
  savePlatformConnection,
  testPlatformPath,
} from "../api/platformsApi";
import {
  buildPlatformDraft,
  buildPlatformDrafts,
  buildPlatformViewDefinitions,
  comparePlatforms,
  formatAffectedProjects,
  formatLastSync,
  getPlatformBucket,
  getPlatformGovernanceNote,
  getPlatformsCopy,
  getProjectScopeLabel,
  getProjectScopeTone,
  getStateLabel,
  getStateTone,
  getSyncModeLabel,
  getSyncModeOptions,
  INITIAL_CUSTOM_PLATFORM_FORM,
  matchesPlatformSearch,
  matchesPlatformView,
  normalizePlatformKeyInput,
  resolveSupportedSyncMode,
  upsertPlatformConnection,
} from "../model/platformPresentation";
import type { CustomPlatformForm, PlatformDraft, PlatformViewKey } from "../model/platformPresentation";
import "../styles.css";

const { Title, Text } = Typography;

const PLATFORM_CONFIRM_MODAL_PROPS = {
  centered: true,
  icon: null,
  className: "platforms-confirm-modal",
} as const;

function PlatformGovernanceImpactPreview({
  impact,
  items,
  note,
}: {
  impact: PlatformGovernanceImpact;
  items: Array<{ label: string; value: ReactNode }>;
  note: string;
}) {
  return (
    <div className="platforms-page__impact">
      <div className="platforms-page__impact-grid">
        {items.map((item) => (
          <div key={item.label} className="platforms-page__impact-item">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      <div className="platforms-page__impact-note">{note}</div>
      <div className="platforms-page__impact-path">{impact.displayName ?? impact.platformName}</div>
    </div>
  );
}

export function PlatformsPage() {
  const { message, modal } = App.useApp();
  const { resolvedLanguage } = useI18n();
  const copy = useMemo(() => getPlatformsCopy(resolvedLanguage), [resolvedLanguage]);
  const platformViewDefinitions = useMemo(
    () => buildPlatformViewDefinitions(resolvedLanguage),
    [resolvedLanguage],
  );
  const [platforms, setPlatforms] = useState<PlatformConnection[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PlatformDraft>>({});
  const [activeView, setActiveView] = useState<PlatformViewKey>("enabled");
  const [expandedPlatformName, setExpandedPlatformName] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  const [testingKeys, setTestingKeys] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CustomPlatformForm>(INITIAL_CUSTOM_PLATFORM_FORM);
  const [testingCustomPath, setTestingCustomPath] = useState(false);

  const bucketCounts = useMemo(() => {
    const counts: Record<PlatformViewKey, number> = {
      all: platforms.length,
      enabled: 0,
      detected: 0,
      catalog: 0,
      custom: 0,
    };

    platforms.forEach((platform) => {
      counts[getPlatformBucket(platform)] += 1;
    });

    return counts;
  }, [platforms]);

  const normalizedCreateKey = useMemo(
    () => normalizePlatformKeyInput(createForm.platformName),
    [createForm.platformName],
  );

  const applyPlatformSnapshot = (nextPlatforms: PlatformConnection[]) => {
    setPlatforms(nextPlatforms);
    setDrafts(buildPlatformDrafts(nextPlatforms));
  };

  const applyPlatformConnection = (nextPlatform: PlatformConnection) => {
    setPlatforms((current) => upsertPlatformConnection(current, nextPlatform));
    setDrafts((current) => ({
      ...current,
      [nextPlatform.platformName]: buildPlatformDraft(nextPlatform),
    }));
  };

  const removePlatformConnectionState = (platformName: string) => {
    setPlatforms((current) =>
      current.filter((platform) => platform.platformName !== platformName),
    );
    setDrafts((current) => {
      const next = { ...current };
      delete next[platformName];
      return next;
    });
  };

  const visiblePlatforms = useMemo(
    () =>
      platforms
        .filter((platform) => matchesPlatformView(platform, activeView))
        .filter((platform) => matchesPlatformSearch(platform, searchValue))
        .sort((left, right) => comparePlatforms(left, right, resolvedLanguage)),
    [activeView, platforms, resolvedLanguage, searchValue],
  );

  useEffect(() => {
    if (
      expandedPlatformName &&
      !visiblePlatforms.some((platform) => platform.platformName === expandedPlatformName)
    ) {
      setExpandedPlatformName(null);
    }
  }, [expandedPlatformName, visiblePlatforms]);

  const loadPlatforms = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setLoadingError(null);

    try {
      const nextPlatforms = await listPlatformConnections();
      applyPlatformSnapshot(nextPlatforms);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLoadingError(errorMessage);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadPlatforms();
  }, []);

  const updateDraft = (platformName: string, updater: (draft: PlatformDraft) => PlatformDraft) => {
    setDrafts((current) => {
      const existingDraft = current[platformName] ?? {
        enabled: false,
        skillsDir: "",
        syncMode: "copy",
      };

      return {
        ...current,
        [platformName]: updater(existingDraft),
      };
    });
  };

  const handlePickDirectory = async (platformName: string) => {
    const folderPath = await pickPlatformDirectory();
    if (!folderPath) {
      return;
    }

    updateDraft(platformName, (draft) => ({
      ...draft,
      skillsDir: folderPath,
    }));
  };

  const persistPlatformDraft = async (
    platform: PlatformConnection,
    draft: PlatformDraft,
    successMessage: string,
  ) => {
    const normalizedSyncMode = resolveSupportedSyncMode(
      draft.syncMode,
      platform.supportsCopy,
      platform.supportsSymlink,
    );

    setSavingKeys((current) => ({
      ...current,
      [platform.platformName]: true,
    }));

    try {
      const savedPlatform = await savePlatformConnection({
        platformName: platform.platformName,
        enabled: draft.enabled,
        skillsDir: draft.skillsDir.trim() || undefined,
        syncMode: normalizedSyncMode,
      });
      applyPlatformConnection(savedPlatform);
      message.success(successMessage);
      return true;
    } catch (error) {
      message.error(copy.saveFailed(error instanceof Error ? error.message : String(error)));
      return false;
    } finally {
      setSavingKeys((current) => ({
        ...current,
        [platform.platformName]: false,
      }));
    }
  };

  const handleDeleteCustomPlatform = async (platform: PlatformConnection) => {
    try {
      const impact = await getPlatformGovernanceImpact(platform.platformName);
      modal.confirm({
        ...PLATFORM_CONFIRM_MODAL_PROPS,
        title: copy.deleteCustomTitle(platform.displayName ?? platform.platformName),
        content: (
          <PlatformGovernanceImpactPreview
            impact={impact}
            items={[
              { label: copy.impactGlobalRelease, value: impact.globalReleaseCount },
              { label: copy.impactProjectConnection, value: impact.projectConnectionCount },
              { label: copy.impactAssignment, value: impact.assignmentCount },
              {
                label: copy.impactAffectedProjects,
                value: formatAffectedProjects(impact, copy.impactNone),
              },
            ]}
            note={copy.deleteImpactDescription}
          />
        ),
        okText: copy.delete,
        cancelText: copy.cancel,
        okButtonProps: {
          danger: true,
        },
        onOk: async () => {
          try {
            await deleteCustomPlatform({ platformName: platform.platformName });
            removePlatformConnectionState(platform.platformName);
            setExpandedPlatformName((current) =>
              current === platform.platformName ? null : current,
            );
            message.success(copy.deleteSuccess(platform.displayName ?? platform.platformName));
          } catch (error) {
            message.error(copy.deleteFailed(error instanceof Error ? error.message : String(error)));
            throw error;
          }
        },
      });
    } catch (error) {
      message.error(copy.deleteFailed(error instanceof Error ? error.message : String(error)));
    }
  };

  const handleSave = async (platform: PlatformConnection) => {
    const draft = drafts[platform.platformName] ?? buildPlatformDraft(platform);
    await persistPlatformDraft(
      platform,
      draft,
      copy.savedConfig(platform.displayName ?? platform.platformName),
    );
  };

  const handleQuickToggle = async (platform: PlatformConnection, enabled: boolean) => {
    const previousDraft = drafts[platform.platformName] ?? buildPlatformDraft(platform);
    const nextDraft = {
      ...previousDraft,
      enabled,
    };
    const performToggle = async () => {
      setDrafts((current) => ({
        ...current,
        [platform.platformName]: nextDraft,
      }));

      const persisted = await persistPlatformDraft(
        platform,
        nextDraft,
        copy.quickToggle(platform.displayName ?? platform.platformName, enabled),
      );

      if (!persisted) {
        setDrafts((current) => ({
          ...current,
          [platform.platformName]: previousDraft,
        }));
      }
    };

    if (previousDraft.enabled && !enabled) {
      try {
        const impact = await getPlatformGovernanceImpact(platform.platformName);
        modal.confirm({
          ...PLATFORM_CONFIRM_MODAL_PROPS,
          title: copy.disableImpactTitle(platform.displayName ?? platform.platformName),
          content: (
            <PlatformGovernanceImpactPreview
              impact={impact}
              items={[
                { label: copy.impactGlobalRelease, value: impact.globalReleaseCount },
                {
                  label: copy.impactEnabledProjectConnection,
                  value: impact.enabledProjectConnectionCount,
                },
                { label: copy.impactEnabledAssignment, value: impact.enabledAssignmentCount },
                {
                  label: copy.impactAffectedProjects,
                  value: formatAffectedProjects(impact, copy.impactNone),
                },
              ]}
              note={copy.disableImpactDescription}
            />
          ),
          okText: copy.disable,
          cancelText: copy.cancel,
          okButtonProps: { danger: true },
          onOk: performToggle,
        });
      } catch (error) {
        message.error(copy.saveFailed(error instanceof Error ? error.message : String(error)));
      }
      return;
    }

    await performToggle();
  };

  const handleTestPath = async (platform: PlatformConnection) => {
    const draft = drafts[platform.platformName] ?? buildPlatformDraft(platform);
    const skillsDir = draft.skillsDir.trim();

    if (!skillsDir) {
      message.warning(copy.testPathRequired);
      return;
    }

    setTestingKeys((current) => ({
      ...current,
      [platform.platformName]: true,
    }));

    try {
      const result = await testPlatformPath(skillsDir);
      if (result.ok) {
        message.success({
          content: copy.testPathSuccess,
          duration: 1.4,
        });
      } else {
        message.warning({
          content: result.message,
          duration: 1.8,
        });
      }
    } catch (error) {
      message.error(copy.testPathFailed(error instanceof Error ? error.message : String(error)));
    } finally {
      setTestingKeys((current) => ({
        ...current,
        [platform.platformName]: false,
      }));
    }
  };

  const updateCreateForm = (patch: Partial<CustomPlatformForm>) => {
    setCreateForm((current) => {
      const next = {
        ...current,
        ...patch,
      };
      next.syncMode = resolveSupportedSyncMode(
        next.syncMode,
        next.supportsCopy,
        next.supportsSymlink,
      );
      return next;
    });
  };

  const resetCreateModal = () => {
    setCreateForm(INITIAL_CUSTOM_PLATFORM_FORM);
    setTestingCustomPath(false);
    setCreating(false);
    setCreateOpen(false);
  };

  const handlePickCustomDirectory = async () => {
    const folderPath = await pickPlatformDirectory();
    if (!folderPath) {
      return;
    }

    updateCreateForm({ skillsDir: folderPath });
  };

  const handleTestCustomPath = async () => {
    const skillsDir = createForm.skillsDir.trim();
    if (!skillsDir) {
      message.warning(copy.testPathRequired);
      return;
    }

    setTestingCustomPath(true);
    try {
      const result = await testPlatformPath(skillsDir);
      if (result.ok) {
        message.success({
          content: copy.testPathSuccess,
          duration: 1.4,
        });
      } else {
        message.warning({
          content: result.message,
          duration: 1.8,
        });
      }
    } catch (error) {
      message.error(copy.testPathFailed(error instanceof Error ? error.message : String(error)));
    } finally {
      setTestingCustomPath(false);
    }
  };

  const handleCreatePlatform = async () => {
    const displayName = createForm.displayName.trim();
    const skillsDir = createForm.skillsDir.trim();

    if (!displayName) {
      message.error(copy.createNameRequired);
      return;
    }

    if (!normalizedCreateKey) {
      message.error(copy.createKeyRequired);
      return;
    }

    if (!skillsDir) {
      message.error(copy.createDirRequired);
      return;
    }

    if (!createForm.supportsCopy && !createForm.supportsSymlink) {
      message.error(copy.createModeRequired);
      return;
    }

    const input: CreateCustomPlatformInput = {
      platformName: normalizedCreateKey,
      displayName,
      skillsDir,
      syncMode: resolveSupportedSyncMode(
        createForm.syncMode,
        createForm.supportsCopy,
        createForm.supportsSymlink,
      ),
      supportsProjectScope: createForm.supportsProjectScope,
      supportsSymlink: createForm.supportsSymlink,
      supportsCopy: createForm.supportsCopy,
    };

    setCreating(true);
    try {
      const createdPlatform = await createCustomPlatform(input);
      applyPlatformConnection(createdPlatform);
      setActiveView("custom");
      setExpandedPlatformName(createdPlatform.platformName);
      setSearchValue("");
      message.success(copy.createSuccess(displayName));
      resetCreateModal();
    } catch (error) {
      message.error(copy.createFailed(error instanceof Error ? error.message : String(error)));
      setCreating(false);
    }
  };

  return (
    <div className="platforms-page">
      <section className="platforms-page__hero">
        <div className="platforms-page__hero-copy">
          <Title level={3} className="platforms-page__title">
            {copy.heroTitle}
          </Title>
        </div>

        <div className="platforms-page__hero-actions">
          <Button onClick={() => void loadPlatforms()} loading={loading}>
            {copy.refresh}
          </Button>
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            {copy.addCustom}
          </Button>
        </div>
      </section>

      {loadingError ? (
        <Alert
          showIcon
          type="error"
          message={copy.loadFailed}
          description={loadingError}
        />
      ) : null}

      {loading ? (
        <div className="platforms-page__loading">{copy.loading}</div>
      ) : null}

      {!loading && platforms.length === 0 ? (
        <Empty
          className="platforms-page__empty"
          description={copy.empty}
        />
      ) : null}

      {!loading && platforms.length > 0 ? (
        <>
          <section className="platforms-page__toolbar">
            <div className="platforms-page__toolbar-main">
              <Segmented
                className="platforms-page__segmented"
                value={activeView}
                options={platformViewDefinitions.map((definition) => ({
                  value: definition.key,
                  label: (
                    <span className="platforms-page__segmented-option">
                      <span className="platforms-page__segmented-label">{definition.label}</span>
                      <span className="platforms-page__segmented-count">
                        {bucketCounts[definition.key]}
                      </span>
                    </span>
                  ),
                }))}
                onChange={(value) => setActiveView(value as PlatformViewKey)}
              />
            </div>
            <Input
              allowClear
              className="platforms-page__search"
              value={searchValue}
              placeholder={copy.searchPlaceholder}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </section>
        </>
      ) : null}

      {!loading && platforms.length > 0 && visiblePlatforms.length === 0 ? (
        <Empty
          className="platforms-page__empty"
          description={copy.filteredEmpty}
        />
      ) : null}

      {!loading && visiblePlatforms.length > 0 ? (
        <div className="platforms-page__grid">
          {visiblePlatforms.map((platform) => {
            const draft = drafts[platform.platformName] ?? buildPlatformDraft(platform);
            const syncModeOptions = getSyncModeOptions(platform, resolvedLanguage);
            const resolvedSyncMode = resolveSupportedSyncMode(
              draft.syncMode,
              platform.supportsCopy,
              platform.supportsSymlink,
            );
            const displayName = platform.displayName ?? platform.platformName;
            const tone = getStateTone(platform);
            const isExpanded = expandedPlatformName === platform.platformName;

            return (
              <article
                key={platform.id}
                className={`platforms-page__card platforms-page__card--${tone}${isExpanded ? " is-expanded" : ""}`}
              >
                <div className="platforms-page__card-head">
                  <div className="platforms-page__card-brand">
                    <PlatformLogo
                      platformName={platform.platformName}
                      displayName={displayName}
                    />
                    <div className="platforms-page__card-copy">
                      <strong className="platforms-page__card-title">{displayName}</strong>
                      <div className="platforms-page__card-meta">
                        <span className={`platforms-page__state platforms-page__state--${tone}`}>
                          {getStateLabel(platform, resolvedLanguage)}
                        </span>
                        <span className="platforms-page__card-meta-separator" />
                        <span className="platforms-page__card-meta-text">
                          {platform.platformType === "custom" ? copy.customPlatform : copy.builtinPlatform}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="platforms-page__card-actions">
                    <div className="platforms-page__card-actions-stack">
                      <Button
                        type="text"
                        className="platforms-page__expand-button"
                        onClick={() =>
                          setExpandedPlatformName((current) =>
                            current === platform.platformName ? null : platform.platformName,
                          )
                        }
                      >
                        {isExpanded ? copy.collapseConfig : copy.viewConfig}
                      </Button>
                      <div className="platforms-page__quick-toggle">
                        <Switch
                          aria-label={copy.enableSwitch(displayName)}
                          checked={draft.enabled}
                          loading={!!savingKeys[platform.platformName]}
                          onChange={(checked) => {
                            void handleQuickToggle(platform, checked);
                          }}
                        />
                      </div>
                    </div>
                    {platform.platformType === "custom" ? (
                      <Dropdown
                        trigger={["click"]}
                        placement="bottomRight"
                        menu={{
                          items: [
                            {
                              key: "delete",
                              label: copy.deletePlatform,
                              danger: true,
                            },
                          ],
                          onClick: ({ key }) => {
                            if (key === "delete") {
                              void handleDeleteCustomPlatform(platform);
                            }
                          },
                        }}
                      >
                        <Button
                          type="text"
                          className="platforms-page__more-button"
                          aria-label={copy.moreActions(displayName)}
                        >
                          <MoreHorizontal size={16} />
                        </Button>
                      </Dropdown>
                    ) : null}
                  </div>
                </div>

                <div className="platforms-page__card-summary platforms-page__card-summary--compact">
                  <div className="platforms-page__summary-item">
                    <span>{copy.recentSync}</span>
                    <strong>{formatLastSync(platform.lastSyncAt, resolvedLanguage)}</strong>
                  </div>
                  <div className="platforms-page__summary-item">
                    <span>{copy.syncMode}</span>
                    <strong>{getSyncModeLabel(resolvedSyncMode, resolvedLanguage)}</strong>
                  </div>
                  <div className="platforms-page__summary-item platforms-page__summary-item--path">
                    <span>{copy.syncDirectory}</span>
                    <strong title={draft.skillsDir || copy.notSet}>{draft.skillsDir || copy.notSet}</strong>
                  </div>
                </div>

                <div className="platforms-page__card-governance">
                  <span
                    className={`platforms-page__capability platforms-page__capability--${getProjectScopeTone(platform)}`}
                  >
                    {getProjectScopeLabel(platform, resolvedLanguage)}
                  </span>
                  <span className="platforms-page__card-governance-text">
                    {getPlatformGovernanceNote(platform, resolvedLanguage)}
                  </span>
                </div>

                {isExpanded ? (
                  <div className="platforms-page__editor">
                    <div className="platforms-page__editor-grid">
                      <div className="platforms-page__editor-fields">
                        <div className="platforms-page__editor-field">
                          <span className="platforms-page__field-label">{copy.syncModeField}</span>
                          <Select
                            className="platforms-page__select platforms-page__select--compact"
                            value={resolvedSyncMode}
                            options={syncModeOptions}
                            onChange={(value) => {
                              updateDraft(platform.platformName, (current) => ({
                                ...current,
                                syncMode: value,
                              }));
                            }}
                          />
                        </div>

                        <div className="platforms-page__editor-field">
                          <span className="platforms-page__field-label">{copy.syncDirectoryField}</span>
                          <Input
                            value={draft.skillsDir}
                            placeholder={copy.syncDirectoryPlaceholder}
                            onChange={(event) => {
                              const { value } = event.target;
                              updateDraft(platform.platformName, (current) => ({
                                ...current,
                                skillsDir: value,
                              }));
                            }}
                          />
                        </div>

                        <div className="platforms-page__editor-toolbar">
                          <div className="platforms-page__editor-actions-group">
                            <Button
                              className="platforms-page__action-button platforms-page__action-button--subtle"
                              onClick={() => void handlePickDirectory(platform.platformName)}
                            >
                              {copy.chooseFolder}
                            </Button>
                            <Button
                              className="platforms-page__action-button platforms-page__action-button--subtle"
                              onClick={() => void handleTestPath(platform)}
                              loading={!!testingKeys[platform.platformName]}
                            >
                              {copy.testPath}
                            </Button>
                          </div>
                          <Button
                            type="primary"
                            className="platforms-page__action-button platforms-page__action-button--primary"
                            onClick={() => void handleSave(platform)}
                            loading={!!savingKeys[platform.platformName]}
                          >
                            {copy.saveConfig}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      <Modal
        rootClassName="platforms-modal"
        open={createOpen}
        title={copy.createTitle}
        okText={copy.createConfirm}
        cancelText={copy.cancel}
        confirmLoading={creating}
        onOk={() => void handleCreatePlatform()}
        onCancel={resetCreateModal}
      >
        <div className="platforms-page__modal-fields">
          <div className="platforms-page__field platforms-page__field--column">
            <span className="platforms-page__field-label">{copy.platformName}</span>
            <Input
              value={createForm.displayName}
              placeholder={copy.platformNamePlaceholder}
              onChange={(event) => updateCreateForm({ displayName: event.target.value })}
            />
          </div>

          <div className="platforms-page__field platforms-page__field--column">
            <span className="platforms-page__field-label">{copy.platformKey}</span>
            <Input
              value={createForm.platformName}
              placeholder={copy.platformKeyPlaceholder}
              onBlur={() => updateCreateForm({ platformName: normalizedCreateKey })}
              onChange={(event) => updateCreateForm({ platformName: event.target.value })}
            />
            <Text type="secondary" className="platforms-page__hint">
              {copy.finalKey}
              <span className="platforms-page__mono">{normalizedCreateKey || copy.notGenerated}</span>
            </Text>
          </div>

          <div className="platforms-page__field platforms-page__field--column">
            <span className="platforms-page__field-label">{copy.syncDirectory}</span>
            <div className="platforms-page__path-row">
              <Input
                value={createForm.skillsDir}
                placeholder={copy.syncDirectoryPlaceholder}
                onChange={(event) => updateCreateForm({ skillsDir: event.target.value })}
              />
              <Button onClick={() => void handlePickCustomDirectory()}>{copy.chooseFolderShort}</Button>
            </div>
          </div>

          <div className="platforms-page__field platforms-page__field--inline">
            <span className="platforms-page__field-label">{copy.defaultSyncMode}</span>
            <Select
              className="platforms-page__select"
              size="small"
              value={resolveSupportedSyncMode(
                createForm.syncMode,
                createForm.supportsCopy,
                createForm.supportsSymlink,
              )}
              options={getSyncModeOptions(createForm, resolvedLanguage)}
              onChange={(value) => updateCreateForm({ syncMode: value })}
            />
          </div>

          <div className="platforms-page__switch-grid">
            <div className="platforms-page__switch-item">
              <span>{copy.supportsCopy}</span>
              <Switch
                checked={createForm.supportsCopy}
                onChange={(checked) => updateCreateForm({ supportsCopy: checked })}
              />
            </div>
            <div className="platforms-page__switch-item">
              <span>{copy.supportsSymlink}</span>
              <Switch
                checked={createForm.supportsSymlink}
                onChange={(checked) => updateCreateForm({ supportsSymlink: checked })}
              />
            </div>
            <div className="platforms-page__switch-item">
              <span>{copy.supportsProjectScope}</span>
              <Switch
                checked={createForm.supportsProjectScope}
                onChange={(checked) => updateCreateForm({ supportsProjectScope: checked })}
              />
            </div>
          </div>

          <div className="platforms-page__actions">
            <Button
              className="platforms-page__action-button platforms-page__action-button--subtle"
              onClick={() => void handleTestCustomPath()}
              loading={testingCustomPath}
            >
              {copy.testPathShort}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
