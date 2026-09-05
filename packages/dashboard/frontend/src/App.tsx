import { useEffect, useState } from 'react';
import { api } from './api';
import type { AlertItem, Dispute, EvalMetrics, LiveEvent, Merchant, Page, Payment, Policy, Stats } from './types';
import { Layout } from './components/layout/Layout';
import { Overview } from './pages/Overview';
import { Payments } from './pages/Payments';
import { Rules } from './pages/Rules';
import { Merchants } from './pages/Merchants';
import { Alerts } from './pages/Alerts';
import { Chargebacks } from './pages/Chargebacks';
import { ModelCard } from './pages/ModelCard';

export function App() {
  const [page, setPage] = useState<Page>('overview');
  const [live, setLive] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [metrics, setMetrics] = useState<EvalMetrics | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);

  async function refresh() {
    try {
      const [s, p, pol, mer, al, d, m] = await Promise.all([
        api.stats(),
        api.payments(),
        api.policies(),
        api.merchants(),
        api.alerts(),
        api.disputes(),
        api.metrics(),
      ]);
      setStats(s);
      setPayments(p.transactions);
      setPolicies(pol.policies);
      setMerchants(mer.agents);
      setAlerts(al.alerts);
      setDisputes(d.disputes);
      setMetrics(m);
      setLive(true);
    } catch {
      setLive(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 2500);
    const source = new EventSource('/events');
    source.onmessage = (msg) => {
      try {
        const raw = JSON.parse(msg.data) as Record<string, unknown>;
        const type = typeof raw.type === 'string' ? raw.type : 'event';
        setEvents((prev) => [{ type, receivedAt: new Date().toISOString(), raw }, ...prev].slice(0, 40));
        void refresh();
      } catch {
        /* ignore malformed SSE */
      }
    };
    source.onerror = () => setLive(false);
    return () => {
      window.clearInterval(timer);
      source.close();
    };
  }, []);

  return (
    <Layout page={page} onChange={setPage} live={live}>
      {page === 'overview' ? <Overview stats={stats} payments={payments} events={events} /> : null}
      {page === 'payments' ? <Payments payments={payments} /> : null}
      {page === 'rules' ? <Rules policies={policies} /> : null}
      {page === 'merchants' ? <Merchants merchants={merchants} payments={payments} /> : null}
      {page === 'alerts' ? <Alerts alerts={alerts} /> : null}
      {page === 'chargebacks' ? <Chargebacks disputes={disputes} /> : null}
      {page === 'model' ? <ModelCard metrics={metrics} /> : null}
    </Layout>
  );
}
