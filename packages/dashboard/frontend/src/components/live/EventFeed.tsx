import type { LiveEvent } from '../../types';
import { clock } from '../../format';

export function EventFeed({ events }: { events: LiveEvent[] }) {
  return (
    <div className="feed">
      {events.length === 0 ? <p className="muted">SSE idle — events appear as payments hit the stack.</p> : null}
      {events.map((ev, i) => (
        <div className="feed-item" key={`${ev.receivedAt}-${i}`}>
          <time>{clock(ev.receivedAt)}</time>
          <div>
            <strong>{ev.type}</strong>
            <div className="muted">{summarize(ev)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function summarize(ev: LiveEvent): string {
  const raw = ev.raw;
  if (ev.type === 'connected') return 'Console subscribed';
  if (typeof raw.reason === 'string') return raw.reason;
  const tx = raw.transaction as { purpose?: string; amount?: number } | undefined;
  if (tx?.purpose) return `${tx.purpose}${tx.amount ? ` · ₹${tx.amount}` : ''}`;
  const alert = raw.alert as { message?: string } | undefined;
  if (alert?.message) return alert.message;
  return 'State change';
}
