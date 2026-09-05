export function RiskGauge({ score }: { score: number }) {
  const color = score < 30 ? '#1b7f4e' : score < 60 ? '#a15c07' : '#c4473a';
  const label = score < 30 ? 'Quiet' : score < 60 ? 'Elevated' : 'Hot';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="44" fill="none" stroke="#eef0f3" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r="44"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray="276.46"
          strokeDashoffset={276.46 - (Math.min(100, Math.max(0, score)) / 100) * 276.46}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="66" textAnchor="middle" fontFamily="Cascadia Mono, Consolas, monospace" fontSize="22" fontWeight="600" fill="#0f1728">
          {score}
        </text>
      </svg>
      <div>
        <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Session posture</div>
        <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{label}</div>
        <div className="muted">0–30 quiet · 30–60 elevated · 60+ spike</div>
      </div>
    </div>
  );
}
