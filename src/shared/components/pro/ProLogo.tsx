interface ProLogoProps {
  compact?: boolean;
}

export function ProLogo({ compact = false }: ProLogoProps) {
  return (
    <span className={`pro-logo${compact ? " pro-logo--compact" : ""}`} aria-label="Skill Studio Pro">
      <img src="/assets/brand/skill-studio-pro-mark.svg" alt="" aria-hidden="true" />
      {!compact ? (
        <span className="pro-logo__copy">
          <strong>Skill Studio</strong>
          <span>PRO</span>
        </span>
      ) : null}
    </span>
  );
}
