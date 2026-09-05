import type { EvalMetrics } from '../types';
import { inr, pct } from '../format';
import { StatCard } from '../components/cards/StatCard';
import { PageHeader } from '../components/ui/PageHeader';

export function ModelCard({ metrics }: { metrics: EvalMetrics | null }) {
  if (!metrics) return <p className="empty">Loading held-out metrics…</p>;
  const c = metrics.detection.confusion;

  return (
    <>
      <PageHeader
        kicker="Held-out card"
        title="Fraud-spike detector"
        subtitle="One loss class. Chronological 80/20 split. Honest false-positive cost in INR."
      />

      <div className="hero-metric">
        <div>
          <div className="label">False-positive cost</div>
          <div className="value">{inr(metrics.blocking.falsePositiveCostInr)}</div>
          <div className="sub">
            {metrics.blocking.falsePositiveCount} blocked legit payments on the test set — jewellery and festival tickets we over-called.
          </div>
        </div>
        <div className="hero-aside">
          <div>
            <div className="k muted">Precision</div>
            <div className="mono" style={{ fontSize: 22, marginTop: 4 }}>{pct(metrics.detection.precision)}</div>
          </div>
          <div>
            <div className="k muted">Recall</div>
            <div className="mono" style={{ fontSize: 22, marginTop: 4 }}>{pct(metrics.detection.recall)}</div>
          </div>
          <div>
            <div className="k muted">F1</div>
            <div className="mono" style={{ fontSize: 22, marginTop: 4 }}>{metrics.detection.f1.toFixed(3)}</div>
          </div>
          <div>
            <div className="k muted">Missed fraud</div>
            <div className="mono" style={{ fontSize: 22, marginTop: 4 }}>{inr(metrics.blocking.missedFraudInr)}</div>
          </div>
        </div>
      </div>

      <div className="grid-4">
        <StatCard label="Precision" value={pct(metrics.detection.precision)} hint="Of flags/blocks, how many were fraud" />
        <StatCard label="Recall" value={pct(metrics.detection.recall)} hint="Of fraud in the test set, how many we caught" />
        <StatCard label="F1" value={metrics.detection.f1.toFixed(3)} />
        <StatCard label="Test set" value={String(metrics.testSize)} hint={`${metrics.trainSize} train / ${metrics.datasetSize} total`} />
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Confusion · test set ({metrics.testSize})</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th className="num">Predicted risk</th>
                  <th className="num">Predicted clean</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Actual fraud</td>
                  <td className="num score-ok">{c.truePositive}</td>
                  <td className="num score-hot">{c.falseNegative}</td>
                </tr>
                <tr>
                  <td>Actual legit</td>
                  <td className="num score-hot">{c.falsePositive}</td>
                  <td className="num score-ok">{c.trueNegative}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            Flag ≥ {metrics.thresholds.flag}, block ≥ {metrics.thresholds.block}. Train only warms velocity windows.
          </p>
        </div>
        <div className="card">
          <h2>What we are honest about</h2>
          <ul style={{ paddingLeft: 18, color: 'var(--ink-2)', margin: 0 }}>
            {metrics.notes.map((note) => <li key={note} style={{ marginBottom: 8 }}>{note}</li>)}
            <li>Missed fraud in the block layer: {inr(metrics.blocking.missedFraudInr)} — stealth daytime drains.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
