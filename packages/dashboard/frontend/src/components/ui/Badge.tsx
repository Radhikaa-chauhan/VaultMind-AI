import { paymentState } from '../../format';

export function StatusBadge({ status, riskAction }: { status: string; riskAction?: unknown }) {
  const state = paymentState(status, riskAction);
  const label = state === 'allowed' ? 'Allowed' : state === 'blocked' ? 'Blocked' : state === 'flagged' ? 'Flagged' : 'Pending';
  const cls = state === 'allowed' ? 'ok' : state === 'blocked' ? 'bad' : state === 'flagged' ? 'warn' : 'muted';
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const cls = severity === 'critical' ? 'bad' : severity === 'warning' ? 'warn' : 'info';
  return <span className={`badge ${cls}`}>{severity}</span>;
}
