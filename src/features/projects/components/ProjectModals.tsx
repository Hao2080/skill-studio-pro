import Button from "antd/es/button";
import Empty from "antd/es/empty";
import Form from "antd/es/form";
import type { FormInstance } from "antd/es/form";
import Input from "antd/es/input";
import Modal from "antd/es/modal";
import Select from "antd/es/select";
import Switch from "antd/es/switch";
import type { PlatformConnection, Skill, TestPlatformPathResult } from "@/types/skill";
import { pickProjectPlatformDirectory, pickProjectRootDirectory } from "../api/projectsApi";
import type { BindSkillDraft, ProjectPlatformConnection, ProjectSyncPlanRecord } from "../model/projectTypes";
import type { BindSkillFormValues, PlatformFormValues, ProjectFormValues } from "../model/projectForms";
import type { ProjectCopy } from "../model/projectCopy";
import { ProjectPlatformPathTestResultCard, SyncPlanGroup } from "./ProjectViews";

export function ProjectEditorModal({
  copy,
  form,
  open,
  editingProjectId,
  onCancel,
  onFinish,
}: {
  copy: ProjectCopy;
  form: FormInstance<ProjectFormValues>;
  open: boolean;
  editingProjectId?: string;
  onCancel: () => void;
  onFinish: (values: ProjectFormValues) => void;
}) {
  return (
    <Modal
      rootClassName="projects-modal"
      title={editingProjectId ? copy.editProject : copy.newProject}
      open={open}
      okText={editingProjectId ? copy.actionSave : copy.actionJoin}
      cancelText={copy.actionCancel}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="name" label={copy.projectName} rules={[{ required: true, message: copy.projectName }]}>
          <Input placeholder={copy.projectFormNamePlaceholder} />
        </Form.Item>
        <Form.Item name="rootPath" label={copy.projectRoot} rules={[{ required: true, message: copy.selectProjectRoot }]}>
          <Input
            placeholder={copy.selectProjectRoot}
            addonAfter={
              <button
                type="button"
                className="projects-inline-button"
                onClick={async () => {
                  const path = await pickProjectRootDirectory(copy.selectProjectRoot);
                  if (path) {
                    form.setFieldsValue({ rootPath: path });
                  }
                }}
              >
                {copy.actionSelect}
              </button>
            }
          />
        </Form.Item>
        <Form.Item name="description" label={copy.formDescription}>
          <Input.TextArea rows={2} placeholder={copy.formOptional} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export function ProjectPlatformModal({
  copy,
  form,
  open,
  editingPlatform,
  platformSelectOptions,
  selectedPlatformMode,
  selectedPlatform,
  selectedPlatformName,
  projectPlatformOptionsCount,
  testingProjectPlatformPath,
  platformPathTestResult,
  onCancel,
  onFinish,
  onTestPath,
}: {
  copy: ProjectCopy;
  form: FormInstance<PlatformFormValues>;
  open: boolean;
  editingPlatform?: ProjectPlatformConnection;
  platformSelectOptions: Array<{ value: string; label: string; platform?: PlatformConnection }>;
  selectedPlatformMode: PlatformFormValues["pathMode"];
  selectedPlatform?: PlatformConnection;
  selectedPlatformName?: string;
  projectPlatformOptionsCount: number;
  testingProjectPlatformPath: boolean;
  platformPathTestResult?: TestPlatformPathResult;
  onCancel: () => void;
  onFinish: (values: PlatformFormValues) => void;
  onTestPath: () => void;
}) {
  return (
    <Modal
      rootClassName="projects-modal"
      title={editingPlatform ? copy.configureProjectPlatform : copy.addProjectPlatform}
      open={open}
      okText={copy.actionSave}
      okButtonProps={{ disabled: !editingPlatform && projectPlatformOptionsCount === 0 }}
      cancelText={copy.actionCancel}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ pathMode: "derived", syncMode: "copy", enabled: true }}
        onFinish={onFinish}
      >
        <Form.Item name="platformName" label={copy.platform} rules={[{ required: true, message: copy.selectPlatform }]}>
          <Select
            disabled={Boolean(editingPlatform)}
            options={platformSelectOptions}
            notFoundContent={copy.noProjectPlatformsInCenter}
            placeholder={copy.selectPlatform}
          />
        </Form.Item>
        <Form.Item name="pathMode" label={copy.directory}>
          <Select
            options={[
              { value: "derived", label: copy.pathModeDerived },
              { value: "custom", label: copy.pathModeCustom },
            ]}
          />
        </Form.Item>
        {selectedPlatformMode === "derived" ? (
          <Form.Item name="relativeSkillsDir" label={copy.relativeDirectory}>
            <Input placeholder={selectedPlatform ? `${copy.pathModeDerived} ${selectedPlatform.platformName}` : ".codex/skills"} />
          </Form.Item>
        ) : (
          <Form.Item name="skillsDir" label={copy.projectDirectory} rules={[{ required: true, message: copy.selectProjectDirectory }]}>
            <Input
              placeholder={copy.selectProjectDirectory}
              addonAfter={
                <button
                  type="button"
                  className="projects-inline-button"
                  onClick={async () => {
                    const path = await pickProjectPlatformDirectory(copy.selectProjectDirectory);
                    if (path) {
                      form.setFieldsValue({ skillsDir: path });
                    }
                  }}
                >
                  {copy.actionSelect}
                </button>
              }
            />
          </Form.Item>
        )}
        <div className="projects-form-inline-actions">
          <Button
            className="projects-button projects-button--secondary"
            onClick={onTestPath}
            loading={testingProjectPlatformPath}
            disabled={!selectedPlatformName && !editingPlatform}
          >
            {copy.actionTestPath}
          </Button>
        </div>
        {platformPathTestResult ? <ProjectPlatformPathTestResultCard copy={copy} result={platformPathTestResult} /> : null}
        <Form.Item name="syncMode" label={copy.actionSync}>
          <Select options={[{ value: "copy", label: copy.copySync }]} />
        </Form.Item>
        <Form.Item name="enabled" label={copy.actionEnable} valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export function ProjectBindingModal({
  copy,
  form,
  bindDraft,
  skills,
  onCancel,
  onFinish,
  onSkillChange,
}: {
  copy: ProjectCopy;
  form: FormInstance<BindSkillFormValues>;
  bindDraft?: BindSkillDraft;
  skills: Skill[];
  onCancel: () => void;
  onFinish: (values: BindSkillFormValues) => void;
  onSkillChange: (skillId: string) => void;
}) {
  return (
    <Modal
      rootClassName="projects-modal"
      title={bindDraft?.assignmentId ? copy.editProjectBinding : copy.bindSkill}
      open={Boolean(bindDraft)}
      okText={copy.actionSave}
      cancelText={copy.actionCancel}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" initialValues={{ enabled: true }} onFinish={onFinish}>
        <Form.Item name="skillId" label={copy.skill} rules={[{ required: true, message: copy.skill }]}>
          <Select
            showSearch
            disabled={Boolean(bindDraft?.assignmentId)}
            optionFilterProp="label"
            options={skills.map((skill) => ({ value: skill.id, label: skill.name }))}
            onChange={(value) => onSkillChange(value)}
          />
        </Form.Item>
        <Form.Item name="snapshotId" label={copy.version} rules={[{ required: true, message: copy.version }]}>
          <Select
            options={(bindDraft?.snapshots ?? []).map((snapshot) => ({
              value: snapshot.id,
              label: `v${snapshot.snapshotNumber}${snapshot.isActive ? ` / ${copy.filterReady}` : ""}${snapshot.isCurrent ? ` / ${copy.latestUpdated}` : ""}`,
            }))}
          />
        </Form.Item>
        <Form.Item name="targetDirName" label={copy.managedPath}>
          <Input placeholder={copy.targetSlugPlaceholder} />
        </Form.Item>
        <Form.Item name="enabled" label={copy.actionEnable} valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export function ProjectSyncPlanModal({
  copy,
  open,
  titleSuffix,
  canExecute,
  syncPlanRecords,
  executableRecordCount,
  skippedRecords,
  pendingConfirmationRecords,
  readyRecords,
  confirmationRecords,
  blockedRecords,
  confirmedSyncAssignmentIds,
  onCancel,
  onExecute,
  onToggleSelection,
}: {
  copy: ProjectCopy;
  open: boolean;
  titleSuffix: string;
  canExecute: boolean;
  syncPlanRecords: ProjectSyncPlanRecord[];
  executableRecordCount: number;
  skippedRecords: ProjectSyncPlanRecord[];
  pendingConfirmationRecords: ProjectSyncPlanRecord[];
  readyRecords: ProjectSyncPlanRecord[];
  confirmationRecords: ProjectSyncPlanRecord[];
  blockedRecords: ProjectSyncPlanRecord[];
  confirmedSyncAssignmentIds: string[];
  onCancel: () => void;
  onExecute: () => void;
  onToggleSelection: (assignmentId: string, checked: boolean) => void;
}) {
  return (
    <Modal
      rootClassName="projects-modal"
      title={`${copy.syncPlan}${titleSuffix ? ` · ${titleSuffix}` : ""}`}
      open={open}
      okText={copy.syncRun}
      cancelText={copy.actionClose}
      okButtonProps={{ disabled: !canExecute }}
      onCancel={onCancel}
      onOk={onExecute}
    >
      <div className="projects-sync-plan">
        {syncPlanRecords.length === 0 ? (
          <Empty description={copy.emptyBindings} />
        ) : (
          <>
            <div className="projects-sync-plan__summary">
              <div className="projects-sync-plan__summary-card">
                <span>{copy.directExecutable}</span>
                <strong>{executableRecordCount}</strong>
              </div>
              <div className="projects-sync-plan__summary-card">
                <span>{copy.skippedThisRun}</span>
                <strong>{skippedRecords.length}</strong>
              </div>
              <div className="projects-sync-plan__summary-card">
                <span>{copy.pendingConfirmation}</span>
                <strong>{pendingConfirmationRecords.length}</strong>
              </div>
              <div className="projects-sync-plan__summary-card">
                <span>{copy.blocked}</span>
                <strong>{blockedRecords.length}</strong>
              </div>
            </div>
            <SyncPlanGroup
              copy={copy}
              title={copy.directExecutable}
              description={copy.directExecutableDescription}
              tone="success"
              records={readyRecords}
            />
            <SyncPlanGroup
              copy={copy}
              title={copy.skippedThisRun}
              description={copy.skippedThisRunDescription}
              tone="neutral"
              records={skippedRecords}
            />
            <SyncPlanGroup
              copy={copy}
              title={copy.pendingConfirmation}
              description={copy.pendingConfirmationDescription}
              tone="warning"
              records={confirmationRecords}
              selectable
              selectedAssignmentIds={confirmedSyncAssignmentIds}
              onToggleSelection={onToggleSelection}
            />
            <SyncPlanGroup
              copy={copy}
              title={copy.blockingItems}
              description={copy.blockingItems}
              tone="error"
              records={blockedRecords}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
