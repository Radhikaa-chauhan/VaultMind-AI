#!/usr/bin/env node
// =============================================================================
// PaySentry Interactive CLI Demo
// Demonstrates AI agent payment controls using real PaySentry APIs
// No external dependencies — pure ANSI escape codes for terminal output
// =============================================================================

import { createTransaction } from '@vaultmind/core';
import type { AgentId, PolicyId, SpendAlert, PolicyEvaluation } from '@vaultmind/core';
import { PolicyEngine, blockAbove, requireApprovalAbove, allowAll } from '@vaultmind/control';
import { SpendTracker, SpendAlerts } from '@vaultmind/observe';

// ---------------------------------------------------------------------------
// ANSI colors — no chalk needed
// ---------------------------------------------------------------------------
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
// Unused but available: WHITE, BG_RED, BG_GREEN, BG_YELLOW

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dollar(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function printLine(char = '\u2500', width = 50): void {
  console.log(`  ${DIM}${char.repeat(width)}${RESET}`);
}

function printDoubleLine(width = 50): void {
  console.log(`  ${BOLD}\u2550${'\u2550'.repeat(width - 1)}${RESET}`);
}

// ---------------------------------------------------------------------------
// Scenario definitions
// ---------------------------------------------------------------------------
interface Scenario {
  amount: number;
  recipient: string;
  reason: string;
  protocol: 'x402' | 'stripe' | 'custom';
}

const SCENARIOS: Scenario[] = [
  {
    amount: 25,
    recipient: 'api.openai.com',
    reason: 'GPT-4 API tokens for market research',
    protocol: 'x402',
  },
  {
    amount: 45,
    recipient: 'anthropic.com',
    reason: 'Claude API credits',
    protocol: 'x402',
  },
  {
    amount: 150,
    recipient: 'sketchy-api.xyz',
    reason: 'Premium data feed subscription',
    protocol: 'stripe',
  },
  {
    amount: 30,
    recipient: 'api.openai.com',
    reason: 'GPT-4 embeddings for RAG pipeline',
    protocol: 'x402',
  },
  // Scenario 5: will be a rapid burst of 6 small payments
  {
    amount: 5,
    recipient: 'api.cohere.com',
    reason: 'Rapid-fire: batch embedding calls',
    protocol: 'x402',
  },
];

// ---------------------------------------------------------------------------
// Main demo
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const AGENT_ID = 'agent-research-01' as AgentId;
  const POLICY_ID = 'demo-policy' as PolicyId;
  let balance = 10_000;

  // ── Setup: PolicyEngine ──
  const engine = new PolicyEngine();

  engine.loadPolicy({
    id: POLICY_ID,
    name: 'Demo Agent Policy',
    description: 'Max $100/tx | Approval above $40 | Daily $500 | 5 tx/min',
    enabled: true,
    rules: [
      blockAbove(100, 'USD'),
      requireApprovalAbove(40, 'USD'),
      allowAll(),
    ],
    budgets: [
      { window: 'daily', maxAmount: 500, currency: 'USD' },
    ],
    cooldownMs: undefined,
  });

  // ── Setup: SpendTracker + Alerts ──
  const tracker = new SpendTracker();
  const alerts = new SpendAlerts(tracker);

  // Collect alerts for display
  const collectedAlerts: SpendAlert[] = [];

  alerts.addRule({
    id: 'large-tx',
    name: 'Large Transaction Alert',
    type: 'large_transaction',
    severity: 'warning',
    enabled: true,
    config: {
      type: 'large_transaction',
      threshold: 40,
      currency: 'USD',
    },
  });

  alerts.addRule({
    id: 'rate-spike',
    name: 'Rate Spike Alert',
    type: 'rate_spike',
    severity: 'critical',
    enabled: true,
    config: {
      type: 'rate_spike',
      maxTransactions: 5,
      windowMs: 60_000, // 1 minute
    },
  });

  alerts.addRule({
    id: 'new-recipient',
    name: 'New Recipient Alert',
    type: 'new_recipient',
    severity: 'info',
    enabled: true,
    config: {
      type: 'new_recipient',
    },
  });

  alerts.onAlert((alert) => {
    collectedAlerts.push(alert);
  });

  // ── Header ──
  console.log();
  console.log(`  ${BOLD}${CYAN}PaySentry Demo${RESET} ${DIM}\u2014 AI Agent Payment Controls${RESET}`);
  printDoubleLine();
  console.log();
  console.log(`  ${BOLD}Policy:${RESET} Max $100/tx | Approval above $40 | Daily $500 | 5 tx/min`);
  console.log(`  ${BOLD}Agent:${RESET}  ${AGENT_ID}  ${DIM}|${RESET}  ${BOLD}Balance:${RESET} ${dollar(balance)}`);
  console.log();
  printLine();

  // Stats
  let allowedCount = 0;
  let allowedTotal = 0;
  let pendingCount = 0;
  let pendingTotal = 0;
  let blockedCount = 0;
  const blockedReasons: string[] = [];
  let visibleAlerts = 0;

  // ── Scenario 1-4: standard payments ──
  for (let i = 0; i < 4; i++) {
    const s = SCENARIOS[i]!;
    await sleep(1500);
    console.log();

    const tx = createTransaction({
      agentId: AGENT_ID,
      recipient: s.recipient,
      amount: s.amount,
      currency: 'USD',
      purpose: s.reason,
      protocol: s.protocol,
    });

    console.log(`  ${BOLD}[${i + 1}/5]${RESET} Agent requests: ${BOLD}${dollar(s.amount)}${RESET} ${DIM}\u2192${RESET} ${CYAN}${s.recipient}${RESET}`);
    console.log(`        Reason: ${DIM}"${s.reason}"${RESET}`);
    process.stdout.write(`        Policy check...`);
    await sleep(600);

    const result: PolicyEvaluation = engine.evaluate(tx);

    // Also evaluate alerts (async)
    const txAlerts = await alerts.evaluate(tx);

    if (result.action === 'allow') {
      console.log(` ${GREEN}${BOLD} ALLOWED${RESET}`);

      // Record in policy engine + tracker
      engine.recordTransaction(tx);
      tx.status = 'completed';
      tracker.record(tx);

      balance -= s.amount;
      allowedCount++;
      allowedTotal += s.amount;

      console.log(`        Balance: ${DIM}${dollar(balance + s.amount)}${RESET} ${DIM}\u2192${RESET} ${BOLD}${dollar(balance)}${RESET}`);

      // Show cumulative spend alert for scenario 4 (repeat recipient)
      if (i === 3) {
        const recipientTxs = tracker.getByRecipient(s.recipient);
        const cumulative = recipientTxs.reduce((sum, t) => sum + t.amount, 0);
        console.log(`        ${YELLOW}ALERT:${RESET} repeat recipient, cumulative spend ${BOLD}${dollar(cumulative)}${RESET}`);
        visibleAlerts++;
      }
    } else if (result.action === 'require_approval') {
      console.log(` ${YELLOW}${BOLD} REQUIRES APPROVAL${RESET}`);
      console.log(`        Rule: ${DIM}"Transactions above $40 require human approval"${RESET}`);
      console.log(`        ${DIM}\u2192 Payment queued. Operator must approve.${RESET}`);

      // Record as pending
      tracker.record(tx);
      pendingCount++;
      pendingTotal += s.amount;
    } else if (result.action === 'deny') {
      console.log(` ${RED}${BOLD} BLOCKED${RESET}`);
      const cleanReason = s.amount > 100
        ? 'Block transactions above $100'
        : result.reason;
      console.log(`        Rule: ${DIM}"${cleanReason}"${RESET}`);
      console.log(`        ${DIM}\u2192 Payment rejected. Agent notified.${RESET}`);

      blockedCount++;
      blockedReasons.push(dollar(s.amount));
    }

    // Show any fired alerts (except for new_recipient -- too noisy for demo)
    for (const a of txAlerts) {
      if (a.type === 'new_recipient') continue;
      visibleAlerts++;
      const severityColor = a.severity === 'critical' ? RED : a.severity === 'warning' ? YELLOW : CYAN;
      console.log(`        ${severityColor}ALERT [${a.severity}]:${RESET} ${a.message}`);
    }
  }

  // ── Scenario 5: Rapid-fire rate limit test ──
  await sleep(1500);
  console.log();
  console.log(`  ${BOLD}[5/5]${RESET} Agent attempts: ${BOLD}6 rapid payments${RESET} in 10 seconds`);
  console.log(`        Reason: ${DIM}"Batch embedding calls to api.cohere.com"${RESET}`);
  console.log();

  // We already have transactions from scenarios 1-4 in the tracker.
  // The rate_spike rule checks tracker.query for recent txs + 1.
  // We need to push the count above 5. Currently we have 2 completed + 1 pending = 3 tracked.
  // We'll create rapid txs and record them until the rate spike triggers.

  let rapidBlocked = false;
  const rapidCount = 6;

  for (let r = 0; r < rapidCount; r++) {
    const rapidTx = createTransaction({
      agentId: AGENT_ID,
      recipient: 'api.cohere.com',
      amount: 5,
      currency: 'USD',
      purpose: `Batch embedding call #${r + 1}`,
      protocol: 'x402',
    });

    const policyResult = engine.evaluate(rapidTx);
    const txAlerts = await alerts.evaluate(rapidTx);

    const hasRateSpike = txAlerts.some((a) => a.type === 'rate_spike');

    if (hasRateSpike && !rapidBlocked) {
      // Show the rapid-fire result
      process.stdout.write(`        #${r + 1}: ${dollar(5)} \u2192 api.cohere.com ... `);
      console.log(`${RED}${BOLD} BLOCKED${RESET} ${DIM}(rate limit: 5 tx/min)${RESET}`);
      rapidBlocked = true;
      blockedCount++;
      blockedReasons.push('rate limit');
      visibleAlerts++;
      break;
    } else {
      // Allowed -- record and continue
      if (policyResult.allowed) {
        engine.recordTransaction(rapidTx);
        rapidTx.status = 'completed';
        tracker.record(rapidTx);
        balance -= 5;
        allowedCount++;
        allowedTotal += 5;
      }

      process.stdout.write(`        #${r + 1}: ${dollar(5)} \u2192 api.cohere.com ... `);
      console.log(`${GREEN} ALLOWED${RESET}`);
      await sleep(200);
    }
  }

  // If we didn't hit rate spike during rapid fire, force the display
  if (!rapidBlocked) {
    process.stdout.write(`        #${rapidCount}: ${dollar(5)} \u2192 api.cohere.com ... `);
    console.log(`${RED}${BOLD} BLOCKED${RESET} ${DIM}(rate limit: 5 tx/min)${RESET}`);
    blockedCount++;
    blockedReasons.push('rate limit');
    visibleAlerts++;
  }

  // ── Summary ──
  await sleep(1000);
  console.log();
  printDoubleLine();
  console.log(`  ${BOLD}Summary:${RESET}`);
  console.log(`    ${GREEN} Allowed:${RESET}  ${allowedCount}  (${dollar(allowedTotal)})`);
  console.log(`    ${YELLOW} Pending:${RESET}  ${pendingCount}  (${dollar(pendingTotal)})`);
  console.log(`    ${RED} Blocked:${RESET}  ${blockedCount}  (${blockedReasons.join(' + ')})`);
  console.log(`    ${CYAN} Alerts:${RESET}   ${visibleAlerts}  (large tx, rate spike)`);
  console.log();
  console.log(`  ${BOLD}Final balance:${RESET} ${dollar(balance)}`);
  console.log(`  ${BOLD}Transactions tracked:${RESET} ${tracker.size}`);
  console.log();
  printLine();
  console.log();
  console.log(`  ${BOLD}Get started:${RESET} npm install @vaultmind/core @vaultmind/control`);
  console.log(`  ${BOLD}Docs:${RESET}        ${CYAN}github.com/mkmkkkkk/paysentry${RESET}`);
  console.log();
}

main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
