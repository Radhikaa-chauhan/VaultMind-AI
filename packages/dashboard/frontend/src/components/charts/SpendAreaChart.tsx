interface Point {
  hour: string;
  allowed: number;
  blocked: number;
}

export function SpendAreaChart({ data }: { data: Point[] }) {
  const rows = data.some((d) => d.allowed + d.blocked > 0)
    ? data.filter((_, i) => i >= data.length - 8)
    : data.slice(-8);
  const max = Math.max(1, ...rows.map((d) => d.allowed + d.blocked));

  return (
    <div className="bars" role="img" aria-label="Allowed versus blocked payments">
      {rows.map((d) => {
        const allowedH = (d.allowed / max) * 100;
        const blockedH = (d.blocked / max) * 100;
        return (
          <div className="bars-col" key={d.hour}>
            <div className="bars-stack">
              <span className="bars-blocked" style={{ height: `${blockedH}%` }} title={`${d.blocked} blocked`} />
              <span className="bars-allowed" style={{ height: `${allowedH}%` }} title={`${d.allowed} allowed`} />
            </div>
            <span>{d.hour}</span>
          </div>
        );
      })}
    </div>
  );
}
