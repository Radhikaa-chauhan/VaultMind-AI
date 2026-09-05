import type { Dispute } from '../types';
import { clock, inr, initials, merchantName } from '../format';
import { PageHeader } from '../components/ui/PageHeader';

export function Chargebacks({ disputes }: { disputes: Dispute[] }) {
  return (
    <>
      <PageHeader
        kicker="Protect"
        title="Chargebacks"
        subtitle="Downstream of the detector — not a second product. Evidence rides on provenance."
      />
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Opened</th>
                <th>Merchant</th>
                <th>Reason</th>
                <th>Status</th>
                <th className="num">Requested</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((d) => {
                const merchant = merchantName(d.agentId);
                return (
                  <tr key={d.id}>
                    <td className="mono">{clock(d.createdAt)}</td>
                    <td>
                      <div className="merchant-cell">
                        <span className="avatar">{initials(merchant)}</span>
                        {merchant}
                      </div>
                    </td>
                    <td>{d.reason}</td>
                    <td><span className="badge warn">{d.status.replace('_', ' ')}</span></td>
                    <td className="num">{inr(d.requestedAmount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {disputes.length === 0 ? <p className="empty">No chargebacks in this session.</p> : null}
        </div>
      </div>
    </>
  );
}
