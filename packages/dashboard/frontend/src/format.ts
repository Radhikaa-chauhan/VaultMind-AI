export function inr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function clock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function merchantName(id: string): string {
  if (id.includes('cafe')) return 'Third Wave Coffee';
  if (id.includes('electronics')) return 'Croma Digital';
  if (id.includes('d2c')) return 'Bombay Shirt Company';
  return id;
}

export function paymentState(status: string, riskAction?: unknown): 'allowed' | 'blocked' | 'flagged' | 'pending' {
  if (status === 'rejected' || status === 'failed') return 'blocked';
  if (status === 'pending') return 'pending';
  if (riskAction === 'flag') return 'flagged';
  return 'allowed';
}

export function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function methodLabel(metadata: Record<string, unknown>): string {
  const method = metadata.method;
  if (method === 'card') return 'Card';
  if (method === 'netbanking') return 'Netbanking';
  return 'UPI';
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
