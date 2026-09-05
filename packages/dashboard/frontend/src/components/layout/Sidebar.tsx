import type { Page } from '../../types';

const ITEMS: Array<{ id: Page; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'payments', label: 'Payments' },
  { id: 'rules', label: 'Rules' },
  { id: 'merchants', label: 'Merchants' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'chargebacks', label: 'Chargebacks' },
  { id: 'model', label: 'Model card' },
];

export function Sidebar({ page, onChange }: { page: Page; onChange: (page: Page) => void }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">V</div>
        <div>
          <strong>VaultMind</strong>
          <span>AI Risk Manager</span>
        </div>
      </div>
      <nav className="nav">
        {ITEMS.map((item) => (
          <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => onChange(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <strong>Defense only</strong>
        Hard blocks stay in PolicyEngine. The model ranks and flags. Sandbox INR — no live keys.
      </div>
    </aside>
  );
}
