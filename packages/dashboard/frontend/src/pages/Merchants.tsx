import type { Merchant, Payment } from '../types';
import { inr, initials } from '../format';
import { PageHeader } from '../components/ui/PageHeader';

export function Merchants({ merchants, payments }: { merchants: Merchant[]; payments: Payment[] }) {
  return (
    <>
      <PageHeader
        kicker="Portfolio"
        title="Merchants"
        subtitle="Three synthetic India MIDs for the demo — cafe, electronics, D2C apparel."
      />
      <div className="grid-3">
        {merchants.map((m) => {
          const txs = payments.filter((p) => p.agentId === m.id);
          const blocked = txs.filter((p) => p.status === 'rejected' || p.status === 'failed').length;
          return (
            <div className="card" key={m.id}>
              <div className="merchant-top">
                <span className="avatar lg">{initials(m.name)}</span>
                <div>
                  <h2 style={{ margin: 0 }}>{m.name}</h2>
                  <div className="muted">{String(m.metadata?.city ?? '')} · {String(m.metadata?.category ?? 'Merchant')}</div>
                </div>
              </div>
              <div className="stat" style={{ marginTop: 16 }}>
                <div className="k">Settled volume</div>
                <div className="v">{inr(m.totalSpent)}</div>
              </div>
              <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
                <div>
                  <div className="muted">Trust</div>
                  <div className="mono">{m.trustScore}</div>
                </div>
                <div>
                  <div className="muted">Payments</div>
                  <div className="mono">{txs.length}</div>
                </div>
                <div>
                  <div className="muted">Blocked</div>
                  <div className="mono">{blocked}</div>
                </div>
              </div>
            </div>
          );
        })}
        {merchants.length === 0 ? <p className="empty">Start the live demo to register the three merchants.</p> : null}
      </div>
    </>
  );
}
