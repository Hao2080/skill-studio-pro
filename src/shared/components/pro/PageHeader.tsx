import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="pro-page-header">
      <div className="pro-page-header__copy">
        {eyebrow ? <p className="pro-page-header__eyebrow">{eyebrow}</p> : null}
        <h1 className="pro-page-header__title">{title}</h1>
        {subtitle ? <p className="pro-page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="pro-page-header__actions">{actions}</div> : null}
    </header>
  );
}
