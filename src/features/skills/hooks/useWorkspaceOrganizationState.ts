import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Skill, SkillOrganizationSnapshot } from "@/types/skill";
import {
  batchApplySkillOrganization,
  createSkillCollection,
  ensureSkillTags,
  getSkillOrganizationSnapshot,
} from "../api/organizationApi";
import type { WorkspacePageCopy } from "../model/workspacePagePresentation";
import {
  CATEGORY_ASSIGNMENT_STORAGE_KEY,
  CATEGORY_STORAGE_KEY,
  DEFAULT_CATEGORIES,
  ORGANIZATION_MIGRATION_STORAGE_KEY,
  TAG_ASSIGNMENT_STORAGE_KEY,
  TAG_STORAGE_KEY,
  hasLocalOrganizationData,
  isOrganizationSnapshotEmpty,
  isCustomCategory,
  loadStoredCategories,
  loadStoredCategoryAssignments,
  loadStoredTagAssignments,
  loadStoredTags,
  normalizeNames,
  normalizeTagNames,
  pruneInvalidCategoryAssignments,
  pruneInvalidTagAssignments,
  serializeCustomCategories,
  serializeTags,
  type SkillCategoryMap,
  type SkillTagMap,
} from "../model/workspaceCategories";

function getBrowserStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

interface UseWorkspaceOrganizationStateInput {
  skills: Skill[];
  pageCopy: WorkspacePageCopy;
  onMigrationSuccess: (content: string) => void;
  onMigrationWarning: (content: string) => void;
}

export function useWorkspaceOrganizationState({
  skills,
  pageCopy,
  onMigrationSuccess,
  onMigrationWarning,
}: UseWorkspaceOrganizationStateInput) {
  const browserStorage = getBrowserStorage();
  const initialCategories = useMemo(() => loadStoredCategories(browserStorage), [browserStorage]);
  const initialSkillCategoryMap = useMemo(
    () => loadStoredCategoryAssignments(browserStorage),
    [browserStorage],
  );
  const initialAvailableTags = useMemo(() => loadStoredTags(browserStorage), [browserStorage]);
  const initialSkillTagMap = useMemo(
    () => loadStoredTagAssignments(browserStorage),
    [browserStorage],
  );
  const initialMigrationMarked = useMemo(
    () => browserStorage?.getItem(ORGANIZATION_MIGRATION_STORAGE_KEY) === "1",
    [browserStorage],
  );

  const [categories, setCategories] = useState(initialCategories);
  const [skillCategoryMap, setSkillCategoryMap] = useState<SkillCategoryMap>(initialSkillCategoryMap);
  const [availableTags, setAvailableTags] = useState(initialAvailableTags);
  const [skillTagMap, setSkillTagMap] = useState<SkillTagMap>(initialSkillTagMap);
  const [collectionIdByName, setCollectionIdByName] = useState<Record<string, string>>({});
  const [tagIdByName, setTagIdByName] = useState<Record<string, string>>({});
  const [organizationMode, setOrganizationMode] = useState<"local" | "remote">("local");
  const [organizationRemoteAvailable, setOrganizationRemoteAvailable] = useState(false);
  const [organizationSnapshot, setOrganizationSnapshot] = useState<SkillOrganizationSnapshot | null>(null);
  const [organizationMigrationPending, setOrganizationMigrationPending] = useState(false);
  const organizationBootstrappedRef = useRef(false);
  const migrationRunningRef = useRef(false);

  const applyOrganizationSnapshot = useCallback((snapshot: SkillOrganizationSnapshot) => {
    const nextCategories = [...DEFAULT_CATEGORIES, ...snapshot.collections.map((collection) => collection.name)];
    const nextSkillCategoryMap: SkillCategoryMap = {};
    const nextSkillTagMap: SkillTagMap = {};

    for (const record of snapshot.records) {
      nextSkillCategoryMap[record.skillId] = record.primaryCollectionName ?? null;
      nextSkillTagMap[record.skillId] = normalizeTagNames(record.tagNames);
    }

    setCategories(nextCategories);
    setSkillCategoryMap(nextSkillCategoryMap);
    setAvailableTags(snapshot.tags.map((tag) => tag.name));
    setSkillTagMap(nextSkillTagMap);
    setCollectionIdByName(
      Object.fromEntries(snapshot.collections.map((collection) => [collection.name, collection.id])),
    );
    setTagIdByName(Object.fromEntries(snapshot.tags.map((tag) => [tag.name, tag.id])));
    setOrganizationSnapshot(snapshot);
  }, []);

  const refreshOrganizationSnapshot = useCallback(async () => {
    const snapshot = await getSkillOrganizationSnapshot();
    applyOrganizationSnapshot(snapshot);
    setOrganizationRemoteAvailable(true);
    setOrganizationMode("remote");
    setOrganizationMigrationPending(false);
    return snapshot;
  }, [applyOrganizationSnapshot]);

  useEffect(() => {
    if (organizationBootstrappedRef.current) {
      return;
    }

    organizationBootstrappedRef.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const snapshot = await getSkillOrganizationSnapshot();
        if (cancelled) {
          return;
        }

        const shouldMigrateLocalState =
          !initialMigrationMarked &&
          isOrganizationSnapshotEmpty(snapshot) &&
          hasLocalOrganizationData(categories, skillCategoryMap, availableTags, skillTagMap);

        setOrganizationRemoteAvailable(true);
        setOrganizationSnapshot(snapshot);

        if (shouldMigrateLocalState) {
          setOrganizationMigrationPending(true);
          setCollectionIdByName({});
          setTagIdByName({});
          return;
        }

        applyOrganizationSnapshot(snapshot);
        setOrganizationMode("remote");
        setOrganizationMigrationPending(false);
      } catch {
        if (cancelled) {
          return;
        }

        setOrganizationMode("local");
        setOrganizationRemoteAvailable(false);
        setOrganizationSnapshot(null);
        setOrganizationMigrationPending(false);
        setCollectionIdByName({});
        setTagIdByName({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    applyOrganizationSnapshot,
    availableTags,
    categories,
    initialMigrationMarked,
    skillCategoryMap,
    skillTagMap,
  ]);

  useEffect(() => {
    if (!organizationRemoteAvailable || !organizationMigrationPending || !organizationSnapshot) {
      return;
    }

    if (!isOrganizationSnapshotEmpty(organizationSnapshot) || migrationRunningRef.current) {
      return;
    }

    const hasAssignmentData =
      Object.keys(skillCategoryMap).length > 0 || Object.keys(skillTagMap).length > 0;

    if (hasAssignmentData && skills.length === 0) {
      return;
    }

    migrationRunningRef.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const skillIds = skills.map((skill) => skill.id);
        const migrationCategories = normalizeNames([
          ...categories.filter(isCustomCategory),
          ...Object.values(skillCategoryMap),
        ]);
        const normalizedTags = normalizeNames([
          ...availableTags,
          ...Object.values(skillTagMap).flat(),
        ]);
        const nextSkillCategoryMap =
          pruneInvalidCategoryAssignments(
            skillCategoryMap,
            skillIds,
            [...DEFAULT_CATEGORIES, ...migrationCategories],
          ) ?? skillCategoryMap;
        const nextSkillTagMap = pruneInvalidTagAssignments(skillTagMap, skillIds, normalizedTags) ?? skillTagMap;
        const nextCollectionIdByName: Record<string, string> = {};

        for (const category of migrationCategories) {
          const collection = await createSkillCollection({ name: category });
          nextCollectionIdByName[collection.name] = collection.id;
        }

        let tagIdByName: Record<string, string> = {};
        if (normalizedTags.length > 0) {
          const ensuredTags = await ensureSkillTags({ names: normalizedTags });
          tagIdByName = Object.fromEntries(ensuredTags.map((tag) => [tag.name, tag.id]));
        }

        for (const skillId of skillIds) {
          const primaryCollectionName = nextSkillCategoryMap[skillId];
          const addTagIds = (nextSkillTagMap[skillId] ?? [])
            .map((tagName) => tagIdByName[tagName])
            .filter((tagId): tagId is string => Boolean(tagId));

          if (!primaryCollectionName && addTagIds.length === 0) {
            continue;
          }

          await batchApplySkillOrganization({
            skillIds: [skillId],
            primaryCollectionId: primaryCollectionName
              ? nextCollectionIdByName[primaryCollectionName]
              : undefined,
            addTagIds,
          });
        }

        browserStorage?.setItem(ORGANIZATION_MIGRATION_STORAGE_KEY, "1");

        if (cancelled) {
          return;
        }

        await refreshOrganizationSnapshot();

        if (cancelled) {
          return;
        }

        onMigrationSuccess(pageCopy.migrationSuccess);
      } catch (error) {
        if (!cancelled) {
          setOrganizationMigrationPending(false);
          onMigrationWarning(`${pageCopy.migrationWarningPrefix}${error}`);
        }
      } finally {
        migrationRunningRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    availableTags,
    browserStorage,
    categories,
    onMigrationSuccess,
    onMigrationWarning,
    organizationMigrationPending,
    organizationRemoteAvailable,
    organizationSnapshot,
    refreshOrganizationSnapshot,
    skillCategoryMap,
    skillTagMap,
    pageCopy,
    skills,
  ]);

  useEffect(() => {
    if (!browserStorage) {
      return;
    }

    browserStorage.setItem(CATEGORY_STORAGE_KEY, serializeCustomCategories(categories));
  }, [browserStorage, categories]);

  useEffect(() => {
    if (!browserStorage) {
      return;
    }

    browserStorage.setItem(CATEGORY_ASSIGNMENT_STORAGE_KEY, JSON.stringify(skillCategoryMap));
  }, [browserStorage, skillCategoryMap]);

  useEffect(() => {
    if (!browserStorage) {
      return;
    }

    browserStorage.setItem(TAG_STORAGE_KEY, serializeTags(availableTags));
  }, [availableTags, browserStorage]);

  useEffect(() => {
    if (!browserStorage) {
      return;
    }

    browserStorage.setItem(TAG_ASSIGNMENT_STORAGE_KEY, JSON.stringify(skillTagMap));
  }, [browserStorage, skillTagMap]);

  useEffect(() => {
    const nextAssignments = pruneInvalidCategoryAssignments(
      skillCategoryMap,
      skills.map((skill) => skill.id),
      categories,
    );

    if (nextAssignments) {
      setSkillCategoryMap(nextAssignments);
    }
  }, [categories, skillCategoryMap, skills]);

  useEffect(() => {
    const nextAssignments = pruneInvalidTagAssignments(
      skillTagMap,
      skills.map((skill) => skill.id),
      availableTags,
    );

    if (nextAssignments) {
      setSkillTagMap(nextAssignments);
    }
  }, [availableTags, skillTagMap, skills]);

  return {
    categories,
    setCategories,
    skillCategoryMap,
    setSkillCategoryMap,
    availableTags,
    setAvailableTags,
    skillTagMap,
    setSkillTagMap,
    collectionIdByName,
    tagIdByName,
    organizationMode,
    organizationSnapshot,
    refreshOrganizationSnapshot,
  };
}
