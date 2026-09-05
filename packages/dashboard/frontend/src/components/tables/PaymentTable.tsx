import { Fragment, useState } from 'react';
import type { Payment } from '../../types';
import { clock, inr, initials, merchantName, methodLabel } from '../../format';
import { StatusBadge } from '../ui/Badge';

function scoreClass(score: unknown): string {
  if (typeof score !== 'number') return '';
  if (score >= 72) return 'score-hot';
  if (score >= 42) return 'score-mid';
  return 'score-ok';
}

export function PaymentTable({ payments }: { payments: Payment[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Merchant</th>
            <th>Rail</th>
            <th>Beneficiary</th>
            <th className="num">Amount</th>
            <th>Status</th>
            <th className="num">Score</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => {
            const reasons = Array.isArray(p.metadata.riskReasons) ? (p.metadata.riskReasons as string[]) : [];
            const merchant = merchantName(p.agentId);
            const score = p.metadata.riskScore;
            return (
              <Fragment key={p.id}>
                <tr className="clickable" onClick={() => setOpen(open === p.id ? null : p.id)}>
                  <td className="mono">{clock(p.createdAt)}</td>
                  <td>
                    <div className="merchant-cell">
                      <span className="avatar">{initials(merchant)}</span>
                      {merchant}
                    </div>
                  </td>
                  <td><span className="badge muted">{methodLabel(p.metadata)}</span></td>
                  <td className="mono">{p.recipient}</td>
                  <td className="num">{inr(p.amount)}</td>
                  <td><StatusBadge status={p.status} riskAction={p.metadata.riskAction} /></td>
                  <td className={`num ${scoreClass(score)}`}>{typeof score === 'number' ? score : '—'}</td>
                </tr>
                {open === p.id ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="detail">
                        <strong>{p.purpose}</strong>
                        <div style={{ marginTop: 6 }}>{reasons.length ? reasons.join(' · ') : 'No risk reasons — baseline traffic.'}</div>
                        <div className="muted" style={{ marginTop: 6 }}>{p.id}</div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {payments.length === 0 ? <p className="empty">Waiting for the live demo to start…</p> : null}
    </div>
  );
}
