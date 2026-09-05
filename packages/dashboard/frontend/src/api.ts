import type { AlertItem, Dispute, EvalMetrics, Merchant, Payment, Policy, Stats } from './types';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  stats: () => getJson<Stats>('/api/stats'),
  payments: () => getJson<{ transactions: Payment[] }>('/api/transactions?limit=100'),
  payment: (id: string) => getJson<{ transaction: Payment; provenance: unknown[] }>(`/api/transactions/${encodeURIComponent(id)}`),
  policies: () => getJson<{ policies: Policy[] }>('/api/policies'),
  merchants: () => getJson<{ agents: Merchant[] }>('/api/agents'),
  alerts: () => getJson<{ alerts: AlertItem[] }>('/api/alerts?limit=80'),
  disputes: () => getJson<{ disputes: Dispute[] }>('/api/disputes'),
  metrics: () => getJson<EvalMetrics>('/api/metrics'),
};
