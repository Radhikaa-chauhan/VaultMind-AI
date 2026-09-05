import type { LiveEvent, Payment, Stats } from '../types';
import { inr } from '../format';
import { StatCard } from '../components/cards/StatCard';
import { SpendAreaChart } from '../components/charts/SpendAreaChart';
import { RiskGauge } from '../components/charts/RiskGauge';
import { PaymentTable } from '../components/tables/PaymentTable';
import { EventFeed } from '../components/live/EventFeed';

export function Overview({ stats, payments, events }: { stats: Stats | null; payments: Payment[]; events: LiveEvent[] }) {
  const settled = stats?.completedInr ?? 0;
  const blocked = stats?.blockedInr ?? 0;

  return (
    <>
      <div className="hero-metric">
        <div>
          <div className="label">INR blocked this session</div>
          <div className="value">{inr(blocked)}</div>
          <div className="sub">Money that never settled — a hard rule or the fraud-spike scorer stopped it before the rail.</div>
        </div>
        <div className="hero-aside">
          <div>
            <div className="k muted">Settled</div>
            <div className="mono" style={{ fontSize: 18, marginTop: 4 }}>{inr(settled)}</div>
          </div>
          <div>
            <div className="k muted">Merchants</div>
            <div className="mono" style={{ fontSize: 18, marginTop: 4 }}>{stats?.merchants ?? 0}</div>
          </div>
          <div>
            <div className="k muted">Flagged</div>
            <div className="mono" style={{ fontSize: 18, marginTop: 4 }}>{stats?.flagged ?? 0}</div>
          </div>
          <div>
            <div className="k muted">Chargebacks</div>
            <div className="mono" style={{ fontSize: 18, marginTop: 4 }}>{stats?.openDisputes ?? 0}</div>
          </div>
        </div>
      </div>

      <div className="grid-4">
        <StatCard label="Payments" value={String(stats?.totalTransactions ?? 0)} hint={`${stats?.completed ?? 0} settled`} />
        <StatCard label="Blocked" value={String(stats?.blocked ?? 0)} hint={inr(blocked)} />
        <StatCard label="Model review" value={String(stats?.flagged ?? 0)} hint="Flag is not a deny" />
        <StatCard label="Risk posture" value={String(stats?.risk.score ?? 0)} hint="0 quiet · 100 hot" />
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Allowed vs blocked</h2>
          <div className="legend">
            <span><i className="ok" /> Allowed</span>
            <span><i className="bad" /> Blocked</span>
          </div>
          <SpendAreaChart data={stats?.hours ?? []} />
        </div>
        <div className="card">
          <h2>Session posture</h2>
          <RiskGauge score={stats?.risk.score ?? 0} />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Recent payments</h2>
          <PaymentTable payments={payments.slice(0, 8)} />
        </div>
        <div className="card">
          <h2>Live event log</h2>
          <EventFeed events={events} />
        </div>
      </div>
    </>
  );
}
