# VaultMind AI

**Fraud-spike detector for Indian merchant payments**

Razorpay AI Buildathon 2026 — Track 02: AI Risk Manager

> Stop the merchant losing money to fraud spikes — and show the precision, recall, and false-positive cost.

VaultMind sits on Razorpay-like UPI / card / netbanking traffic. Hard rules **block**. An explainable scorer **flags**. Chargebacks open when a payment later reverses.

This is a defense-only prototype. It does not generate attack traffic except a controlled demo seeder.

---

## Why this exists

Razorpay’s track bar is specific:

- One class of loss
- Measured precision and recall on a held-out test set
- Honest false-positive cost
- Anything offense-capable is disqualified

We implemented **fraud-spike detection** (an official example direction). Chargebacks are the downstream view, not a second product.

---

## Quick start

```bash
npm install
npm run build
npm test
npm run eval:risk
```

Terminal 1 — live stack + API on `http://127.0.0.1:3100`

```bash
npm run demo
```

Terminal 2 — risk console

```bash
npm run dev:ui
```

For the pitch video, one window is enough: after `npm run build`, `npm run demo` serves the console at `http://127.0.0.1:3100`. Optional Vite hot-reload: `npm run dev:ui` on `5173`.

---

## What judges should click

1. **Overview** — primary number is INR blocked this session
2. **Payments** — expand a blocked row for score reasons
3. **Model card** — held-out precision / recall / F1 / FP cost in INR
4. **Chargebacks** — one session case with provenance behind it

Pitch script: [docs/PITCH.md](docs/PITCH.md)

---

## Architecture

```
live-demo.ts
    │
    ▼
VaultMindStack
    ├── PolicyEngine          hard deny / approval / budgets
    ├── FraudSpikeScorer      0–100 + reasons (flag / block)
    ├── SpendTracker          ledger
    ├── SpendAlerts           velocity / new beneficiary
    ├── DisputeManager        chargebacks
    ├── TransactionProvenance audit chain
    └── JsonSnapshotStore     data/vaultmind-snapshot.json
    │
    ▼
dashboard API + SSE  :3100
    │
    ▼
React console        :5173
```

**AI judgment:** the model never overrides a policy deny. Weights are fixed and readable in `packages/observe/src/fraud-spike.ts`. No LLM key required.

**Persistence:** JSON snapshot dual-write (no native `better-sqlite3` on Windows).

**Bind / CORS:** API listens on `127.0.0.1`. CORS allowlist is localhost only. Mutations require `VAULTMIND_DASHBOARD_TOKEN`.

---

## Held-out evaluation

```bash
npm run eval:risk
```

- ~300 labeled INR payments, chronological 80/20 split
- Train split warms velocity windows only — no fitted black box
- Test split is the published card
- Jewelry / festival tickets are deliberate false-positive candidates
- Stealth daytime drains are deliberate misses

---

## Package map

The original control-plane engines remain. Scope is `@vaultmind/*`.

| Package | Role |
|---|---|
| `@vaultmind/core` | Types, events, JSON snapshot store |
| `@vaultmind/control` | Deterministic PolicyEngine |
| `@vaultmind/observe` | Tracker, alerts, **fraud-spike scorer + eval** |
| `@vaultmind/protect` | Provenance + disputes |
| `@vaultmind/mcp` | `VaultMindStack` payment pipeline |
| `@vaultmind/dashboard` | API + SSE |
| `@vaultmind/dashboard-ui` | React risk console |

---

## Security notes

The risk console is a localhost demo, not a public bank API.

- API binds `127.0.0.1` only. CORS is a localhost allowlist — never `*`.
- Mutations require `VAULTMIND_DASHBOARD_TOKEN`. Bearer compare is timing-safe.
- JSON bodies cap size and reject `__proto__` / `constructor` / `prototype`.
- Policy POST accepts only known rule actions, windows, and numeric amounts.
- Responses send `nosniff`, `X-Frame-Options: DENY`, CSP, and `Cache-Control: no-store` on APIs.
- Static files cannot walk above `frontend/dist`.
- Persistence is JSON on disk — no native SQLite addon.
- Demo traffic is synthetic INR. No Razorpay keys, no live rails.
- `.npmrc` sets `ignore-scripts=true` so install hooks cannot run.
- The UI uses only `react` and `react-dom`. Charts are CSS. No Google Fonts CDN.
- `@modelcontextprotocol/sdk` stays for MCP tests only. The live demo imports `@vaultmind/mcp/stack` and does not load that SDK. Remaining `npm audit` hits are that SDK’s unused HTTP stack (hono / express), not the dashboard.

---

## License

MIT
