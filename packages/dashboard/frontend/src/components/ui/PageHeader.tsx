import type { ReactNode } from 'react';

export function PageHeader({
  kicker,
  title,
  subtitle,
  extra,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {kicker ? <div className="kicker">{kicker}</div> : null}
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {extra}
    </div>
  );
}
