# @vaultmind/core

Core types, configuration, and shared utilities for [PaySentry](https://github.com/mkmkkkkk/paysentry) — the open-source control plane for AI agent payments.

## Install

```bash
npm install @vaultmind/core
```

## Usage

```typescript
import { createTransaction, type AgentTransaction } from '@vaultmind/core';

const tx = createTransaction({
  agentId: 'research-agent',
  recipient: 'https://api.provider.com/data',
  amount: 0.05,
  currency: 'USDC',
  purpose: 'Market data API call',
  protocol: 'x402',
});
```

## What's included

| Export | Description |
|--------|-------------|
| `AgentTransaction` | Protocol-agnostic transaction type |
| `PaymentProtocol` | `'x402' \| 'acp' \| 'ap2' \| 'stripe'` |
| `TransactionStatus` | Lifecycle states |
| `PolicyResult` | Policy evaluation result |
| `createTransaction()` | Factory with defaults + ID generation |
| `validateTransaction()` | Runtime validation |

## Part of PaySentry

This is one of 5 packages in the PaySentry monorepo:

- **@vaultmind/core** — Types & utilities (this package)
- **@vaultmind/observe** — Spend tracking, analytics, alerts
- **@vaultmind/control** — Policy engine, spending limits, approval workflows
- **@vaultmind/protect** — Provenance, disputes, recovery
- **@vaultmind/sandbox** — Mock protocols for testing without real money

## License

MIT
