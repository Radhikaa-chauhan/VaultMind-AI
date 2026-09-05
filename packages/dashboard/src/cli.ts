#!/usr/bin/env node
// =============================================================================
// vaultmind-dashboard CLI
//
// VAULTMIND_DASHBOARD_PORT   default 3100
// VAULTMIND_DASHBOARD_HOST   default 127.0.0.1
// VAULTMIND_DASHBOARD_TOKEN  optional bearer token
// =============================================================================

import { createDashboardServer } from './index.js';
import { PolicyEngine } from '@vaultmind/control';
import { SpendTracker, SpendAnalytics } from '@vaultmind/observe';
import { TransactionProvenance, DisputeManager } from '@vaultmind/protect';
import { EventBus } from '@vaultmind/core';

const port = parseInt(process.env.VAULTMIND_DASHBOARD_PORT ?? process.env.PAYSENTRY_DASHBOARD_PORT ?? '3100', 10) || 3100;
const host = process.env.VAULTMIND_DASHBOARD_HOST ?? process.env.PAYSENTRY_DASHBOARD_HOST ?? '127.0.0.1';
const bearerToken = process.env.VAULTMIND_DASHBOARD_TOKEN ?? process.env.PAYSENTRY_DASHBOARD_TOKEN;

const tracker = new SpendTracker();

createDashboardServer(
  {
    policyEngine: new PolicyEngine(),
    tracker,
    analytics: new SpendAnalytics(tracker),
    provenance: new TransactionProvenance(),
    disputes: new DisputeManager(),
    events: new EventBus(),
  },
  { port, host, bearerToken },
);

process.stderr.write(`\n  VaultMind AI  ·  Risk console\n`);
process.stderr.write(`  Listening on http://${host}:${port}\n`);
process.stderr.write(`  Auth: ${bearerToken ? 'Bearer token required' : 'read-only (set VAULTMIND_DASHBOARD_TOKEN for writes)'}\n`);
process.stderr.write(`  For the live demo: npx tsx examples/live-demo.ts\n\n`);
