import type { Policy } from '../types';
import { inr } from '../format';
import { PageHeader } from '../components/ui/PageHeader';

export function Rules({ policies }: { policies: Policy[] }) {
  return (
    <>
      <PageHeader
        kicker="Control"
        title="Hard rules"
        subtitle="If a rule says no, it is no. The scorer cannot override a deny."
      />
      <div className="grid-3">
        {policies.map((policy) => (
          <div className="card" key={policy.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={{ margin: 0 }}>{policy.name}</h2>
              <span className={`badge ${policy.enabled ? 'ok' : 'muted'}`}>{policy.enabled ? 'Live' : 'Off'}</span>
            </div>
            <p className="muted">{policy.description ?? '—'}</p>
            <div style={{ margin: '12px 0' }}>
              {policy.rules.map((rule) => (
                <div className="rule-row" key={rule.id}>
                  <span>{rule.name}</span>
                  <span className={`badge ${rule.action === 'deny' ? 'bad' : rule.action === 'require_approval' ? 'warn' : 'ok'}`}>
                    {rule.action.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
            {policy.budgets.map((b) => (
              <div key={b.window} style={{ marginTop: 10 }}>
                <div className="muted">{b.window.replace('_', ' ')} · {inr(b.maxAmount)}</div>
                <div className="bar" style={{ marginTop: 6 }}><span style={{ width: '18%' }} /></div>
              </div>
            ))}
          </div>
        ))}
        {policies.length === 0 ? <p className="empty">No policies loaded.</p> : null}
      </div>
    </>
  );
}
