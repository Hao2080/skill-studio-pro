import Button from "antd/es/button";
import { X } from "lucide-react";
import type { VersionDecisionAction, VersionDecisionModel } from "@/features/snapshots/model/versionDecision";
import type { VersionHistoryCopy } from "@/features/snapshots/model/versionHistoryPresentation";

interface VersionDecisionBarProps {
  copy: VersionHistoryCopy;
  decision: VersionDecisionModel;
  onAction: (action: VersionDecisionAction) => void;
  onDismiss: () => void;
}

export function VersionDecisionBar({ copy, decision, onAction, onDismiss }: VersionDecisionBarProps) {
  return (
    <div className={`version-decision-bar version-decision-bar--${decision.tone}`} aria-label={copy.decisionAria}>
      <span className="version-decision-bar__status">{decision.status}</span>
      <div className="version-decision-bar__copy">
        <strong className="version-decision-bar__title">{decision.title}</strong>
        <div className="version-decision-bar__body">
          <p>{decision.description}</p>
        </div>
      </div>
      <div className="version-decision-bar__actions" role="group" aria-label={copy.decisionActionsAria}>
        <Button type="primary" onClick={() => onAction(decision.primaryAction)}>
          {decision.primaryAction.label}
        </Button>
        {decision.secondaryAction ? (
          <Button onClick={() => onAction(decision.secondaryAction!)}>
            {decision.secondaryAction.label}
          </Button>
        ) : null}
      </div>
      <Button
        type="text"
        size="small"
        aria-label={copy.dismissDecision}
        className="version-decision-bar__dismiss"
        icon={<X size={14} />}
        onClick={onDismiss}
      />
    </div>
  );
}

