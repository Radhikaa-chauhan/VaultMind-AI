import { useEffect, useState } from 'react';
import type { Page } from '../../types';

const TITLES: Record<Page, string> = {
  overview: 'Risk overview',
  payments: 'Payment ledger',
  rules: 'Hard rules',
  merchants: 'Merchants',
  alerts: 'Alert timeline',
  chargebacks: 'Chargebacks',
  model: 'Held-out model card',
};

export function Header({ page, live }: { page: Page; live: boolean }) {
  const [now, setNow] = useState(() => formatIst(new Date()));

  useEffect(() => {
    const id = window.setInterval(() => setNow(formatIst(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="header">
      <h1>{TITLES[page]}</h1>
      <div className="header-meta">
        <span className="env-pill">Sandbox</span>
        <span className="clock">{now}</span>
        <div className="live">
          <span className="dot" style={{ background: live ? '#067647' : '#b42318' }} />
          {live ? 'Live feed' : 'API offline — run npm run demo'}
        </div>
      </div>
    </header>
  );
}

function formatIst(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date) + ' IST';
}
