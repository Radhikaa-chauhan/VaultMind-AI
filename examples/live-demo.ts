/**
 * VaultMind AI live demo — Razorpay Buildathon Track 02
 * Defense-only fraud-spike walkthrough for the 5-minute video.
 *
 *   npx tsx examples/live-demo.ts
 *
 * Dashboard: http://127.0.0.1:3100  (API) and http://127.0.0.1:5173 (Vite UI)
 */

import { resolve } from 'path';
import type { AgentId, PolicyId } from '@vaultmind/core';
import { VaultMindStack, DEFAULT_CONFIG } from '@vaultmind/mcp/stack';
import { createDashboardServer } from '@vaultmind/dashboard';
import { blockAbove, requireApprovalAbove, allowAll, blockRecipient } from '@vaultmind/control';
import { getCachedFraudEval } from '@vaultmind/observe';

const PORT = parseInt(process.env.VAULTMIND_DASHBOARD_PORT ?? '3100', 10) || 3100;
const HOST = '127.0.0.1';

const MERCHANTS = {
  cafe: 'merchant-cafe-01' as AgentId,
  electronics: 'merchant-electronics-02' as AgentId,
  d2c: 'merchant-d2c-03' as AgentId,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function main(): Promise<void> {
  const persistPath = resolve(process.cwd(), 'data', 'vaultmind-snapshot.json');

  const stack = new VaultMindStack(
    {
      ...DEFAULT_CONFIG,
      serverName: 'vaultmind-risk',
      defaultAgentId: MERCHANTS.cafe,
      policy: {
        id: 'inr-production' as PolicyId,
        maxPerTransaction: 25000,
        maxDaily: 200000,
        maxHourly: 80000,
        approvalThreshold: 20000,
        currency: 'INR',
      },
      alerts: {
        largeTransactionThreshold: 15000,
        rateSpikeMaxPerMinute: 5,
        currency: 'INR',
      },
      sandbox: {
        latencyMs: 40,
        failureRate: 0,
        initialBalance: 5_000_000,
      },
    },
    { persistPath },
  );

  stack.registry.registerWithId(MERCHANTS.cafe, {
    name: 'Third Wave Coffee',
    capabilities: ['pay'],
    metadata: { city: 'Bengaluru', category: 'F&B', mid: 'mid_cafe_twc' },
  });
  stack.registry.registerWithId(MERCHANTS.electronics, {
    name: 'Croma Digital',
    capabilities: ['pay'],
    metadata: { city: 'Mumbai', category: 'Electronics', mid: 'mid_croma_bom' },
  });
  stack.registry.registerWithId(MERCHANTS.d2c, {
    name: 'Bombay Shirt Company',
    capabilities: ['pay'],
    metadata: { city: 'Delhi', category: 'D2C apparel', mid: 'mid_bsc_del' },
  });

  stack.policyEngine.removePolicy('inr-production');
  stack.createPolicy({
    id: 'inr-production' as PolicyId,
    name: 'INR merchant hard limits',
    description: 'Deterministic blocks — never an LLM',
    enabled: true,
    rules: [
      blockRecipient('mule.sink@ybl'),
      blockAbove(25000, 'INR'),
      requireApprovalAbove(20000, 'INR'),
      allowAll(),
    ],
    budgets: [
      { window: 'daily', maxAmount: 200000, currency: 'INR' },
      { window: 'hourly', maxAmount: 80000, currency: 'INR' },
    ],
  });

  const metrics = getCachedFraudEval();

  createDashboardServer(
    {
      policyEngine: stack.policyEngine,
      tracker: stack.tracker,
      analytics: stack.analytics,
      provenance: stack.provenance,
      disputes: stack.disputes,
      events: stack.events,
      registry: stack.registry,
      getAlertLog: () => stack.getAlertLog(),
      getEvalMetrics: () => metrics,
    },
    { port: PORT, host: HOST },
  );

  log('');
  log('  VaultMind AI  ·  fraud-spike detector');
  log('  Razorpay Buildathon — Track 02 AI Risk Manager');
  log('  ------------------------------------------------');
  log(`  Console   http://${HOST}:${PORT}`);
  log(`  UI        http://127.0.0.1:5173  (npm run dev:ui)`);
  log(`  Held-out  P=${metrics.detection.precision}  R=${metrics.detection.recall}  F1=${metrics.detection.f1}`);
  log(`  FP cost   ₹${metrics.blocking.falsePositiveCostInr.toLocaleString('en-IN')}`);
  log('');

  type Step = {
    merchant: AgentId;
    to: string;
    amount: number;
    reason: string;
    method: 'upi' | 'card' | 'netbanking';
    delay: number;
    device?: string;
    cardPresent?: boolean;
    recentFailCount?: number;
    dispute?: boolean;
  };

  const steps: Step[] = [
    { merchant: MERCHANTS.cafe, to: 'rahul.nair12@okaxis', amount: 180, reason: 'Iced latte', method: 'upi', delay: 700, device: 'fp-cafe-pos-01' },
    { merchant: MERCHANTS.cafe, to: 'isha.mehra44@ybl', amount: 240, reason: 'Filter coffee x2', method: 'upi', delay: 700, device: 'fp-cafe-pos-01' },
    { merchant: MERCHANTS.d2c, to: 'ananya.b21@ibl', amount: 1899, reason: 'Oxford shirt', method: 'upi', delay: 700, device: 'fp-d2c-app-03' },
    { merchant: MERCHANTS.electronics, to: 'neha.sharma08@ybl', amount: 4299, reason: 'Earbuds', method: 'card', delay: 800, device: 'fp-croma-web-02', cardPresent: true },
    { merchant: MERCHANTS.electronics, to: 'vikram.i33@okhdfcbank', amount: 11499, reason: 'Monitor arm + SSD', method: 'upi', delay: 800, device: 'fp-croma-web-02' },
    { merchant: MERCHANTS.cafe, to: 'unknown.sink99@okaxis', amount: 490, reason: 'UPI collect', method: 'upi', delay: 220, device: 'fp-unknown-burst' },
    { merchant: MERCHANTS.cafe, to: 'unknown.sink99@okaxis', amount: 510, reason: 'UPI collect', method: 'upi', delay: 220, device: 'fp-unknown-burst' },
    { merchant: MERCHANTS.cafe, to: 'unknown.sink99@okaxis', amount: 470, reason: 'UPI collect', method: 'upi', delay: 220, device: 'fp-unknown-burst' },
    { merchant: MERCHANTS.cafe, to: 'unknown.sink99@okaxis', amount: 530, reason: 'UPI collect', method: 'upi', delay: 220, device: 'fp-unknown-burst' },
    { merchant: MERCHANTS.cafe, to: 'unknown.sink99@okaxis', amount: 455, reason: 'UPI collect', method: 'upi', delay: 220, device: 'fp-unknown-burst' },
    { merchant: MERCHANTS.cafe, to: 'unknown.sink99@okaxis', amount: 620, reason: 'UPI collect', method: 'upi', delay: 400, device: 'fp-unknown-burst' },
    { merchant: MERCHANTS.d2c, to: 'mule.sink@ybl', amount: 22000, reason: 'Payout', method: 'upi', delay: 900, device: 'fp-mule-01' },
    { merchant: MERCHANTS.electronics, to: 'stolen.card04@ibl', amount: 18999, reason: 'Laptop hold', method: 'card', delay: 900, device: 'fp-cnp-04', cardPresent: false, recentFailCount: 4 },
    { merchant: MERCHANTS.electronics, to: 'wedding.gold1@okaxis', amount: 62000, reason: 'Wedding jewellery set', method: 'upi', delay: 1000, device: 'fp-wedding-1' },
    { merchant: MERCHANTS.electronics, to: 'pooja.nair19@ybl', amount: 7990, reason: 'Soundbar — later charged back', method: 'card', delay: 900, device: 'fp-croma-web-02', cardPresent: true, dispute: true },
  ];

  log('  Playing 15 merchant payments…\n');

  for (const [i, step] of steps.entries()) {
    const result = await stack.processPayment(
      step.to,
      step.amount,
      'INR',
      step.reason,
      step.merchant,
      {
        applyRiskScore: true,
        protocol: 'custom',
        metadata: {
          method: step.method,
          deviceFingerprint: step.device,
          cardPresent: step.cardPresent,
          recentFailCount: step.recentFailCount,
          city: step.merchant === MERCHANTS.cafe ? 'Bengaluru' : step.merchant === MERCHANTS.electronics ? 'Mumbai' : 'Delhi',
        },
      },
    );

    const badge = result.status === 'completed' ? 'ALLOWED' : result.status === 'requires_approval' ? 'REVIEW' : 'BLOCKED';
    const risk = result.risk ? `  score ${result.risk.score} ${result.risk.action}` : '';
    log(`  [${String(i + 1).padStart(2, '0')}/${steps.length}] ₹${step.amount.toFixed(0).padStart(6)}  ${badge.padEnd(8)}  ${step.reason}${risk}`);

    if (step.dispute && result.transactionId) {
      stack.fileDispute(result.transactionId, 'Customer filed a chargeback — item not received');
      log('           → chargeback opened (Protect pillar)');
    }

    await sleep(step.delay);
  }

  const txs = stack.tracker.query({ limit: 50 });
  const blocked = txs.filter((t) => t.status === 'rejected');
  const blockedInr = blocked.reduce((s, t) => s + t.amount, 0);
  log('');
  log(`  Session  ${txs.length} payments   ${blocked.length} blocked   ₹${blockedInr.toLocaleString('en-IN')} kept off the rails`);
  log('  Leave this process running. Record the UI. Ctrl+C to stop.');
  log('');
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : err}\n`);
  process.exitCode = 1;
});
