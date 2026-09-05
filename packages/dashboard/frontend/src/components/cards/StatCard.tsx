export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card stat">
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {hint ? <div className="muted" style={{ marginTop: 6 }}>{hint}</div> : null}
    </div>
  );
}
