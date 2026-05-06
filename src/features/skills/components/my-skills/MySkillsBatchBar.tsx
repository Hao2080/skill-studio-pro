import Button from "antd/es/button";
import type { WorkspaceBatchCopy } from "@/features/skills/model/workspacePagePresentation";

interface MySkillsBatchBarProps {
  copy: WorkspaceBatchCopy;
  selectedCount: number;
  selectedVisibleCount: number;
  onClear: () => void;
  onApply: () => void;
}

export function MySkillsBatchBar({
  copy,
  selectedCount,
  selectedVisibleCount,
  onClear,
  onApply,
}: MySkillsBatchBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <section className="my-skills-batch-bar" aria-label={copy.barLabel}>
      <div className="my-skills-batch-bar__meta">
        <span className="my-skills-batch-bar__eyebrow">{copy.eyebrow}</span>
        <strong>{copy.selected}</strong>
        <span>
          {selectedVisibleCount === selectedCount
            ? copy.allIncluded
            : copy.partialIncluded}
        </span>
      </div>
      <div className="my-skills-batch-bar__actions">
        <Button
          className="my-skills-batch-bar__action"
          onClick={onClear}
        >
          {copy.clear}
        </Button>
        <Button
          type="primary"
          className="my-skills-batch-bar__action my-skills-batch-bar__action--primary"
          onClick={onApply}
        >
          {copy.apply}
        </Button>
      </div>
    </section>
  );
}

