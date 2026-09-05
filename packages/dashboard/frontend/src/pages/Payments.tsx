import { useMemo, useState } from 'react';
import type { Payment } from '../types';
import { paymentState } from '../format';
import { PaymentTable } from '../components/tables/PaymentTable';
import { PageHeader } from '../components/ui/PageHeader';

type Filter = 'all' | 'allowed' | 'flagged' | 'blocked';

export function Payments({ payments }: { payments: Payment[] }) {
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => ({
    all: payments.length,
    allowed: payments.filter((p) => paymentState(p.status, p.metadata.riskAction) === 'allowed').length,
    flagged: payments.filter((p) => paymentState(p.status, p.metadata.riskAction) === 'flagged').length,
    blocked: payments.filter((p) => paymentState(p.status, p.metadata.riskAction) === 'blocked').length,
  }), [payments]);

  const rows = payments.filter((p) => filter === 'all' || paymentState(p.status, p.metadata.riskAction) === filter);

  return (
    <>
      <PageHeader
        kicker="Ledger"
        title="Payments"
        subtitle="Click a row for score reasons. Amounts are tabular INR. Flag is review, not a deny."
        extra={
          <div className="chips">
            {(['all', 'allowed', 'flagged', 'blocked'] as const).map((id) => (
              <button key={id} className={`chip ${filter === id ? 'active' : ''}`} onClick={() => setFilter(id)}>
                {id[0].toUpperCase() + id.slice(1)} · {counts[id]}
              </button>
            ))}
          </div>
        }
      />
      <div className="card">
        <PaymentTable payments={rows} />
      </div>
    </>
  );
}
