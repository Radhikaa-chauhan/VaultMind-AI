import type { AlertItem } from '../types';
import { clock, merchantName } from '../format';
import { SeverityBadge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';

export function Alerts({ alerts }: { alerts: AlertItem[] }) {
  return (
    <>
      <PageHeader
        kicker="Observe"
        title="Alert timeline"
        subtitle="Velocity bursts and new-beneficiary spikes land here as they fire."
      />
      <div className="card">
        {alerts.length === 0 ? <p className="empty">No alerts yet. Velocity bursts will land here.</p> : null}
        {alerts.map((alert, i) => (
          <div key={`${alert.timestamp}-${i}`} className="rule-row">
            <div>
              <div>{alert.message}</div>
              <div className="muted">{alert.agentId ? merchantName(alert.agentId) : 'system'} · {alert.type}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="mono muted">{clock(alert.timestamp)}</span>
              <SeverityBadge severity={alert.severity} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
