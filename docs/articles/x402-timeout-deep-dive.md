---
title: "x402 Payment Timeouts: Why Your Agent Loses Money and How to Fix It"
published: false
description: "A deep dive into the x402 facilitator timeout race condition (Issue #1062) that causes 100% payment failure on Base network, plus three battle-tested solutions."
tags: x402, ai, blockchain, typescript
series: "x402 in Production"
canonical_url: https://mkyang.ai/blog/x402-timeout-deep-dive
---

Your AI agent just paid $50 for an API call and got nothing back. The wallet was debited. The transaction confirmed on-chain. But the server returned a 402 error and refused to deliver the data. The money is gone. The resource is locked. And your agent has no idea what happened.

This is not a hypothetical scenario. It is the direct consequence of a timing mismatch buried deep in the x402 payment protocol's settlement layer -- one that affects every agent running on Base network through the Coinbase-hosted facilitator. The issue was first documented as [Issue #1062](https://github.com/coinbase/x402/issues/1062) in the x402 repository, and it reveals a fundamental gap between how the protocol assumes blockchain settlement works and how it actually works under load.

This article walks through the root cause, quantifies the impact, and provides three concrete solutions -- from a five-minute config fix to a production-grade settlement state machine. If you are running x402 payments in production, you need to read this before your next deployment.

---

## Table of Contents

1. [How x402 Settlement Works](#how-x402-settlement-works)
2. [The Timeout Race Condition](#the-timeout-race-condition)
3. [Root Cause: Block Time vs. Facilitator Deadline](#root-cause-block-time-vs-facilitator-deadline)
4. [What Happens to the Money](#what-happens-to-the-money)
5. [Related Failure Modes](#related-failure-modes)
6. [Solution 1: Network-Aware Timeouts](#solution-1-network-aware-timeouts)
7. [Solution 2: Settlement State Machine](#solution-2-settlement-state-machine)
8. [Solution 3: Payment Guardian Layer](#solution-3-payment-guardian-layer)
9. [Production Checklist](#production-checklist)
10. [Conclusion](#conclusion)

---

## How x402 Settlement Works

Before we dissect the failure, we need to understand the normal flow. The x402 protocol uses HTTP's long-dormant `402 Payment Required` status code to embed payment negotiation directly into standard HTTP request-response cycles. The settlement path involves eleven discrete steps, but the critical ones for understanding the timeout problem are steps 5 through 10:

```
     Client (Agent)              Resource Server              Facilitator              Base L2
          │                            │                           │                      │
          │── 1. GET /resource ───────>│                           │                      │
          │<── 2. 402 + PAYMENT-REQ ──│                           │                      │
          │                            │                           │                      │
          │   (agent signs ERC-3009    │                           │                      │
          │    TransferWithAuth)       │                           │                      │
          │                            │                           │                      │
          │── 3. GET /resource ───────>│                           │                      │
          │   + X-PAYMENT header       │                           │                      │
          │                            │── 4. POST /verify ──────>│                      │
          │                            │<── 5. { valid: true } ───│                      │
          │                            │                           │                      │
          │                            │── 6. POST /settle ──────>│                      │
          │                            │                           │── 7. Submit tx ────>│
          │                            │                           │                      │
          │                            │                           │   ... waiting for    │
          │                            │                           │   block confirmation │
          │                            │                           │   (2-28 seconds)     │
          │                            │                           │                      │
          │                            │                           │<── 8. tx confirmed ──│
          │                            │<── 9. Settlement OK ─────│                      │
          │<── 10. 200 + resource ────│                           │                      │
```

The key insight: steps 6 through 9 are where the timeout problem lives. The facilitator submits the transaction to Base (step 7), then waits for block confirmation (step 8). The facilitator has an internal deadline for how long it will wait. If that deadline expires before the block confirms, the facilitator returns a settlement failure to the resource server, which then returns a 402 to the client.

The transaction, however, is already submitted to the mempool. It does not care about the facilitator's deadline. It will confirm whenever the next block includes it.

---

## The Timeout Race Condition

[Issue #1062](https://github.com/coinbase/x402/issues/1062) documents this with a specific on-chain transaction as evidence. The reporter provided transaction `0x8e01aace...629ae696`, which confirmed successfully on Base but generated a facilitator error: *"transaction did not confirm in time: context deadline exceeded."*

Here is the timeline of what happened:

```
T+0.0s   Client sends payment request
T+0.3s   Facilitator receives /settle call
T+0.8s   Facilitator submits transaction to Base mempool
T+1.0s   Facilitator starts confirmation polling
         ...
T+5.0s   *** FACILITATOR TIMEOUT TRIGGERS ***
         Facilitator returns: { success: false, error: "context deadline exceeded" }
         Resource server returns: 402 Payment Required
         Client receives error. No data.
         ...
T+14.2s  Transaction confirms on-chain. USDC transferred.
         Nobody is listening anymore.
```

The gap between T+5.0s and T+14.2s is the race condition. The facilitator gave up. The blockchain did not. The money moved. The data did not.

This is not an edge case. On Base network, the standard block time is 2 seconds, but under congestion or during periods of high gas prices, confirmation can take significantly longer. The issue reporter observed confirmation times ranging from 10 to 28 seconds -- well beyond the facilitator's 5-10 second internal deadline.

The failure rate is effectively 100% whenever Base confirmation time exceeds the facilitator timeout. You cannot predict when this will happen. You cannot prevent it from the client side. And you cannot recover the funds through any mechanism in the current x402 specification.

---

## Root Cause: Block Time vs. Facilitator Deadline

The root cause is a mismatch between two independent systems with different timing guarantees. This is a classic distributed systems problem: component A sets a deadline based on assumptions about component B, but component B operates on its own schedule.

**The facilitator's perspective:** The Coinbase-hosted facilitator (CDP) uses a `context.WithTimeout` internally -- likely set to 5-10 seconds for the full settlement round-trip. This timeout was probably calibrated against Solana, where confirmation takes ~400ms and the entire settle round-trip completes in under 2 seconds. It was then applied uniformly across all supported networks, including Base, without accounting for Base's fundamentally different confirmation characteristics under load.

**Base network's perspective:** Base is an Optimistic Rollup (OP Stack) L2 with a standard 2-second block time. Under normal conditions, a transaction submitted to the mempool will be included in the next block within 2-4 seconds. But "normal conditions" is doing a lot of heavy lifting. During periods of high network activity, mempool congestion, or gas price volatility, inclusion can be delayed. Base processes millions of transactions daily, and spikes are common.

The problem is compounded by the ERC-3009 `TransferWithAuthorization` scheme that x402 uses for USDC payments. Unlike a simple ETH transfer, ERC-3009 involves:

1. Validating the authorization signature against the USDC contract
2. Checking the nonce has not been used
3. Executing the `transferWithAuthorization` function
4. Emitting the transfer event

Each of these steps requires gas, and gas estimation itself can fail -- a related problem documented in [Issue #1065](https://github.com/coinbase/x402/issues/1065), which reports a 40% gas estimation failure rate on identical requests.

**Why client-side fixes are impossible:** The [Issue #1062](https://github.com/coinbase/x402/issues/1062) reporter explicitly noted three reasons why agents cannot work around this:

1. The facilitator controls gas pricing and transaction submission. The client has no influence over when or how the transaction is broadcast.
2. The `@x402/fetch` library does not expose timeout configuration. There is no `maxSettlementTimeout` parameter you can pass.
3. No reconciliation mechanism exists. Once the facilitator returns a failure, there is no callback, webhook, or polling endpoint to check whether the transaction eventually confirmed.

---

## What Happens to the Money

This is the question every developer asks first, and the answer is uncomfortable.

**Scenario 1: Transaction confirms after facilitator timeout.**
The USDC transfers from the agent's wallet to the resource server's wallet. The resource server never delivered the resource. The agent has no receipt, no data, and no automated way to request a refund. The money sits in the server operator's wallet, and absent any off-chain dispute mechanism, it stays there.

**Scenario 2: Transaction fails on-chain after facilitator timeout.**
The transaction reverts. Gas was consumed but the USDC transfer did not execute. The agent lost gas fees (paid by the facilitator in this case, but still a cost to the system) and received no resource. This is the "better" outcome.

**Scenario 3: Transaction is stuck in mempool indefinitely.**
Rare, but possible during extreme congestion. The authorization signature may expire (ERC-3009 supports a `validBefore` timestamp), at which point the transaction becomes unexecutable. No USDC moves. No resource is delivered. The authorization nonce is burned.

In all three scenarios, the agent's workflow is broken. If the agent was performing a multi-step task -- research, then analysis, then report generation -- the entire pipeline halts at the payment step. The agent cannot distinguish between "payment failed, retry" and "payment succeeded but confirmation was slow, do not retry or you will pay twice." This ambiguity is the most dangerous aspect of the timeout problem. A naive retry strategy doubles the cost. A conservative no-retry strategy abandons the task entirely. Neither outcome is acceptable for production agent systems.

---

## Related Failure Modes

The timeout race condition is the most severe issue, but it does not exist in isolation. Two related problems compound the risk:

### Gas Estimation Failures (Issue #1065)

[Issue #1065](https://github.com/coinbase/x402/issues/1065) documents intermittent `unable to estimate gas` errors on the `/settle` endpoint when paying with USDC on Base mainnet. The reported failure rate is approximately 60% -- identical API requests succeed 40% of the time and fail the rest.

The root cause turned out to be a race condition in Coinbase's internal systems: after a wallet signs an ERC-3009 authorization, there is approximately a 1-second propagation delay before the facilitator's verification system recognizes the signature as valid. Payments submitted within that window fail because gas estimation cannot simulate a transaction with an unrecognized authorization.

The fix is deceptively simple -- add a 1-second delay between signing and settlement:

```typescript
// Sign the ERC-3009 authorization
const signature = await wallet.signTypedData(authorizationData);

// Wait for Coinbase's internal state propagation
await new Promise(resolve => setTimeout(resolve, 1000));

// Now submit to the facilitator
const settlement = await facilitator.settle(payload, paymentDetails);
```

This is not documented anywhere in the x402 specification or SDK documentation. You discover it by failing in production and reading GitHub issues.

### Verify-OK, Settle-Fail (Issue #961)

[Issue #961](https://github.com/coinbase/x402/issues/961) describes a scenario where the facilitator's `/verify` endpoint accepts a payment payload, but the subsequent `/settle` call fails with `invalid_payload`. Verification creates false confidence -- the developer believes their payload is correctly formatted because it passed verification, but settlement rejects it for reasons the error message does not explain.

The discovered fix involved two undocumented requirements:
- The `name` field in the payment extra data must be `"USD Coin"`, not `"USDC"`
- The transaction amount must exceed a minimum threshold of $0.001

Neither requirement is mentioned in the x402 specification. The error message (`invalid_payload`) provides no indication of which field is wrong or why.

---

## Solution 1: Network-Aware Timeouts

The simplest fix addresses the timeout mismatch directly. If you are running your own facilitator (using the [x402 facilitator example](https://github.com/coinbase/x402/tree/main/examples/typescript/facilitator) as a starting point), you can configure network-specific timeout values.

```typescript
// network-timeouts.ts
// Map chain IDs to appropriate settlement timeout values

interface NetworkTimingConfig {
  /** Maximum time to wait for block confirmation (ms) */
  settlementTimeoutMs: number;
  /** Expected block time under normal conditions (ms) */
  expectedBlockTimeMs: number;
  /** Buffer multiplier for congestion (e.g., 3x = handle 3x normal block time) */
  congestionMultiplier: number;
  /** Delay between signing and settlement submission (ms) */
  postSignDelayMs: number;
}

const NETWORK_TIMING: Record<number, NetworkTimingConfig> = {
  // Base Mainnet
  8453: {
    settlementTimeoutMs: 60_000,  // 60s -- generous, but safe
    expectedBlockTimeMs: 2_000,
    congestionMultiplier: 3,
    postSignDelayMs: 1_000,       // Workaround for Issue #1065
  },
  // Base Sepolia (testnet)
  84532: {
    settlementTimeoutMs: 90_000,  // Testnets are slower
    expectedBlockTimeMs: 2_000,
    congestionMultiplier: 5,
    postSignDelayMs: 1_500,
  },
  // Ethereum Mainnet (if supported in future)
  1: {
    settlementTimeoutMs: 180_000, // 3 minutes for L1
    expectedBlockTimeMs: 12_000,
    congestionMultiplier: 3,
    postSignDelayMs: 500,
  },
};

function getSettlementTimeout(chainId: number): number {
  const config = NETWORK_TIMING[chainId];
  if (!config) {
    // Default: 60 seconds for unknown networks
    console.warn(`No timing config for chain ${chainId}, using 60s default`);
    return 60_000;
  }
  return config.settlementTimeoutMs;
}

function getPostSignDelay(chainId: number): number {
  return NETWORK_TIMING[chainId]?.postSignDelayMs ?? 1_000;
}

export { NETWORK_TIMING, getSettlementTimeout, getPostSignDelay };
export type { NetworkTimingConfig };
```

If you are using the CDP-hosted facilitator, you cannot change its internal timeout. But you can wrap your calls with proper timeout handling:

```typescript
// x402-client-wrapper.ts
import { x402fetch } from '@x402/fetch';

interface PaymentResult {
  success: boolean;
  data?: any;
  settlementStatus: 'confirmed' | 'timeout_pending' | 'failed';
  txHash?: string;
}

async function fetchWithSettlementAwareness(
  url: string,
  wallet: any,
  options: { maxRetries?: number; chainId?: number } = {}
): Promise<PaymentResult> {
  const { maxRetries = 2, chainId = 8453 } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Add post-sign delay to prevent Issue #1065
      const originalSign = wallet.signTypedData.bind(wallet);
      wallet.signTypedData = async (...args: any[]) => {
        const result = await originalSign(...args);
        const delay = getPostSignDelay(chainId);
        await new Promise(resolve => setTimeout(resolve, delay));
        return result;
      };

      const response = await x402fetch(url, {
        method: 'GET',
        paymentWallet: wallet,
      });

      if (response.ok) {
        return {
          success: true,
          data: await response.json(),
          settlementStatus: 'confirmed',
        };
      }

      // If we get a 402 after payment attempt, the settlement likely timed out
      if (response.status === 402 && attempt < maxRetries) {
        console.warn(
          `Settlement may have timed out (attempt ${attempt}/${maxRetries}). ` +
          `Waiting before retry to avoid double-payment...`
        );

        // Critical: wait long enough for the previous tx to either confirm or fail
        const timeout = getSettlementTimeout(chainId);
        await new Promise(resolve => setTimeout(resolve, timeout));

        // TODO: Check on-chain whether the previous payment already settled
        // before retrying. Without this check, you risk paying twice.
        continue;
      }

      return {
        success: false,
        settlementStatus: 'failed',
      };

    } catch (error) {
      if (attempt === maxRetries) {
        return {
          success: false,
          settlementStatus: 'failed',
        };
      }
    }
  }

  return { success: false, settlementStatus: 'failed' };
}

export { fetchWithSettlementAwareness };
```

This is a band-aid. It mitigates the symptom but does not solve the architectural problem. For a proper fix, you need a settlement state machine.

---

## Solution 2: Settlement State Machine

The core problem with the current x402 flow is that settlement has only two states: `success` and `failure`. In reality, blockchain settlement has at least four:

```
                    ┌──────────┐
                    │  IDLE    │
                    └────┬─────┘
                         │ submit tx
                         v
                    ┌──────────┐
          ┌────────│ PENDING  │────────┐
          │        └────┬─────┘        │
          │ tx reverted │ tx confirmed │ timeout
          v             v              v
     ┌──────────┐ ┌──────────┐  ┌───────────┐
     │  FAILED  │ │CONFIRMED │  │UNRESOLVED │
     └──────────┘ └──────────┘  └─────┬─────┘
                                      │ poll chain
                                      v
                                ┌──────────┐
                          ┌─────│ POLLING  │─────┐
                          │     └──────────┘     │
                          │ found                │ not found
                          v                      v
                    ┌──────────┐          ┌──────────┐
                    │CONFIRMED │          │  FAILED  │
                    │(LATE)    │          │(ORPHANED)│
                    └──────────┘          └──────────┘
```

The `UNRESOLVED` and `POLLING` states are what the current x402 specification is missing. Here is a TypeScript implementation:

```typescript
// settlement-state-machine.ts

type SettlementState =
  | 'idle'
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'unresolved'
  | 'polling'
  | 'confirmed_late'
  | 'failed_orphaned';

interface SettlementRecord {
  id: string;
  txHash: string | null;
  state: SettlementState;
  submittedAt: number;
  resolvedAt: number | null;
  chainId: number;
  amount: string;
  payer: string;
  payee: string;
  pollAttempts: number;
  maxPollAttempts: number;
  error: string | null;
}

class SettlementStateMachine {
  private records: Map<string, SettlementRecord> = new Map();
  private readonly pollIntervalMs: number;
  private readonly maxPollDurationMs: number;

  constructor(options: {
    pollIntervalMs?: number;
    maxPollDurationMs?: number;
  } = {}) {
    this.pollIntervalMs = options.pollIntervalMs ?? 5_000;
    this.maxPollDurationMs = options.maxPollDurationMs ?? 120_000; // 2 minutes
  }

  /**
   * Create a new settlement record when a transaction is submitted.
   */
  submit(params: {
    id: string;
    txHash: string;
    chainId: number;
    amount: string;
    payer: string;
    payee: string;
  }): SettlementRecord {
    const maxPollAttempts = Math.floor(
      this.maxPollDurationMs / this.pollIntervalMs
    );

    const record: SettlementRecord = {
      id: params.id,
      txHash: params.txHash,
      state: 'pending',
      submittedAt: Date.now(),
      resolvedAt: null,
      chainId: params.chainId,
      amount: params.amount,
      payer: params.payer,
      payee: params.payee,
      pollAttempts: 0,
      maxPollAttempts,
      error: null,
    };

    this.records.set(params.id, record);
    return record;
  }

  /**
   * Transition when the facilitator confirms settlement within its timeout.
   */
  confirm(id: string): SettlementRecord {
    const record = this.getRecord(id);
    this.assertState(record, ['pending']);
    record.state = 'confirmed';
    record.resolvedAt = Date.now();
    return record;
  }

  /**
   * Transition when the facilitator times out.
   * This does NOT mean the transaction failed -- it means we do not know yet.
   */
  markUnresolved(id: string, error: string): SettlementRecord {
    const record = this.getRecord(id);
    this.assertState(record, ['pending']);
    record.state = 'unresolved';
    record.error = error;
    return record;
  }

  /**
   * Begin polling the chain for transaction status.
   */
  startPolling(id: string): SettlementRecord {
    const record = this.getRecord(id);
    this.assertState(record, ['unresolved']);
    record.state = 'polling';
    return record;
  }

  /**
   * Record a poll attempt result.
   * Returns the updated record with its new state.
   */
  recordPollResult(
    id: string,
    result: { found: boolean; confirmed: boolean; reverted: boolean }
  ): SettlementRecord {
    const record = this.getRecord(id);
    this.assertState(record, ['polling']);
    record.pollAttempts++;

    if (result.found && result.confirmed) {
      record.state = 'confirmed_late';
      record.resolvedAt = Date.now();
      return record;
    }

    if (result.found && result.reverted) {
      record.state = 'failed';
      record.resolvedAt = Date.now();
      record.error = 'Transaction reverted on-chain';
      return record;
    }

    // Not found yet -- check if we have exhausted poll attempts
    if (record.pollAttempts >= record.maxPollAttempts) {
      record.state = 'failed_orphaned';
      record.resolvedAt = Date.now();
      record.error = `Transaction not found after ${record.pollAttempts} poll attempts`;
      return record;
    }

    // Still polling
    return record;
  }

  /**
   * Get all unresolved settlements that need polling.
   */
  getUnresolved(): SettlementRecord[] {
    return [...this.records.values()].filter(
      r => r.state === 'unresolved' || r.state === 'polling'
    );
  }

  /**
   * Determine the appropriate action for the resource server.
   * - 'deliver': Settlement confirmed, serve the resource.
   * - 'wait': Settlement pending or polling, hold the request.
   * - 'reject': Settlement definitively failed, return 402.
   */
  getAction(id: string): 'deliver' | 'wait' | 'reject' {
    const record = this.records.get(id);
    if (!record) return 'reject';

    switch (record.state) {
      case 'confirmed':
      case 'confirmed_late':
        return 'deliver';
      case 'pending':
      case 'unresolved':
      case 'polling':
        return 'wait';
      case 'failed':
      case 'failed_orphaned':
      case 'idle':
        return 'reject';
    }
  }

  private getRecord(id: string): SettlementRecord {
    const record = this.records.get(id);
    if (!record) throw new Error(`Settlement record ${id} not found`);
    return record;
  }

  private assertState(record: SettlementRecord, expected: SettlementState[]) {
    if (!expected.includes(record.state)) {
      throw new Error(
        `Invalid state transition: ${record.state} is not in [${expected.join(', ')}]`
      );
    }
  }
}

export { SettlementStateMachine };
export type { SettlementState, SettlementRecord };
```

The critical difference from the current x402 flow: when the facilitator times out, the resource server does not immediately return a 402. Instead, it transitions the settlement to `unresolved` and begins polling the chain. If the transaction confirms during polling, the resource is delivered -- just later than ideal. If polling exhausts its attempts without finding the transaction, only then does the server return a definitive failure.

This eliminates the "money lost, no data" scenario entirely. The cost is added latency for slow settlements, but that is a far better outcome than lost funds.

---

## Solution 3: Payment Guardian Layer

For production deployments handling significant payment volume, you need more than a state machine. You need a dedicated middleware layer that sits between your agent and the x402 facilitator, providing circuit breaking, retry classification, and automatic recovery.

The pattern looks like this:

```typescript
// payment-guardian.ts

interface GuardianConfig {
  /** Chain ID for network-specific behavior */
  chainId: number;
  /** Circuit breaker: open after N consecutive failures */
  circuitBreakerThreshold: number;
  /** Circuit breaker: recovery probe interval (ms) */
  circuitBreakerRecoveryMs: number;
  /** Maximum settlement wait time (ms) */
  maxSettlementWaitMs: number;
  /** Post-sign delay to prevent gas estimation failures (ms) */
  postSignDelayMs: number;
}

type FailureClassification =
  | 'transient'      // Retry immediately (network blip, rate limit)
  | 'settlement'     // Retry after polling (timeout race condition)
  | 'permanent'      // Do not retry (invalid payload, insufficient balance)
  | 'unknown';       // Escalate to operator

function classifyFailure(error: any): FailureClassification {
  const message = typeof error === 'string' ? error : error?.message ?? '';

  // Settlement timeout -- the critical case from Issue #1062
  if (message.includes('context deadline exceeded')) return 'settlement';
  if (message.includes('did not confirm in time')) return 'settlement';

  // Gas estimation failures -- Issue #1065
  if (message.includes('unable to estimate gas')) return 'transient';

  // Invalid payload -- Issue #961
  if (message.includes('invalid_payload')) return 'permanent';
  if (message.includes('invalid_request')) return 'permanent';

  // Insufficient balance
  if (message.includes('insufficient')) return 'permanent';

  // Rate limiting
  if (message.includes('429') || message.includes('rate limit')) return 'transient';

  return 'unknown';
}
```

The circuit breaker is essential for preventing cascading failures. If the facilitator is consistently timing out -- perhaps due to Base network congestion -- continuing to submit payments will only drain wallets faster. A circuit breaker stops payment attempts after a threshold of consecutive failures, waits for a recovery period, then probes with a single test transaction before resuming normal operation.

Here is how the guardian integrates into an agent's payment flow:

```typescript
// Usage in an AI agent

import { CircuitBreaker } from '@vaultmind/x402';

const breaker = new CircuitBreaker({
  failureThreshold: 3,        // Open after 3 consecutive failures
  recoveryTimeoutMs: 30_000,  // Wait 30s before probing
  halfOpenMaxRequests: 1,     // Allow 1 probe request
});

async function agentPayAndFetch(url: string, wallet: any): Promise<any> {
  const facilitatorUrl = 'https://x402.coinbase.com';

  return breaker.execute(facilitatorUrl, async () => {
    // 1. Post-sign delay (prevents Issue #1065)
    await new Promise(r => setTimeout(r, 1000));

    // 2. Attempt payment
    const response = await x402fetch(url, {
      method: 'GET',
      paymentWallet: wallet,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const classification = classifyFailure(errorText);

      if (classification === 'settlement') {
        // Do NOT count as circuit breaker failure --
        // the payment may still confirm on-chain
        console.warn('Settlement timeout detected. Payment may still confirm.');
        // Trigger async polling (do not block the circuit breaker)
        pollForLateConfirmation(url, wallet).catch(console.error);
      }

      throw new Error(`Payment failed: ${classification} - ${errorText}`);
    }

    return response.json();
  });
}

async function pollForLateConfirmation(
  url: string,
  wallet: any
): Promise<void> {
  // Poll for up to 2 minutes
  const maxAttempts = 24;
  const intervalMs = 5_000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));

    // Check if the tx confirmed by re-requesting with the same payment
    // (a well-implemented server would recognize the already-settled payment)
    try {
      const response = await fetch(url, {
        headers: { 'X-PAYMENT-STATUS-CHECK': 'true' },
      });

      if (response.ok) {
        console.log('Late confirmation detected -- payment settled successfully');
        return;
      }
    } catch {
      // Continue polling
    }
  }

  console.error(
    'Payment may be orphaned. Manual reconciliation required. ' +
    'Check the transaction on BaseScan.'
  );
}
```

The key architectural decision: settlement timeouts should not count as circuit breaker failures. A timeout means the facilitator was slow, not that it is broken. If you trip the circuit breaker on timeouts, you will stop all payments during network congestion -- exactly when you need payments to work the most (because the congestion will eventually clear and the transactions will confirm).

Only count permanent failures (invalid payloads, insufficient balance) and repeated transient failures toward the circuit breaker threshold.

---

## Production Checklist

Before deploying x402 payments in production, verify each of these items:

**1. Settlement timeout is network-appropriate.**
The default facilitator timeout is too aggressive for Base under load. If you run your own facilitator, set it to at least 60 seconds. If you use the CDP facilitator, implement client-side settlement polling.

**2. Post-sign delay is implemented.**
Add a 1-second delay between ERC-3009 signature generation and settlement submission. Without this, you will see 40-60% gas estimation failures ([Issue #1065](https://github.com/coinbase/x402/issues/1065)).

**3. Token name matches exactly.**
Use `"USD Coin"` in the payment extra data, not `"USDC"`. The facilitator silently rejects mismatched names with an unhelpful `invalid_payload` error ([Issue #961](https://github.com/coinbase/x402/issues/961)).

**4. Minimum payment threshold is met.**
The facilitator enforces an undocumented minimum of $0.001 USDC per transaction.

**5. Circuit breaker protects against cascading failures.**
Do not let a failing facilitator drain wallets. Implement a circuit breaker with a failure threshold appropriate to your volume.

**6. Retry logic classifies failure types.**
Not all failures are retryable. Distinguish between transient failures (retry), settlement timeouts (poll, then retry), and permanent failures (abort).

**7. Orphaned payment detection exists.**
Monitor for transactions that confirm on-chain but were reported as failures by the facilitator. This requires comparing your settlement records against on-chain events.

**8. Wallet balance monitoring is active.**
Track your agent's USDC balance separately from the x402 flow. If the balance decreases but the facilitator reports no successful settlements, you have orphaned payments.

**9. Fallback network is configured.**
If Base settlement is consistently slow, consider Solana as a fallback. Solana confirmation (~400ms) is well within any reasonable facilitator timeout.

**10. Alerting covers the settlement gap.**
Set up alerts for: facilitator timeout rate > 5%, gas estimation failure rate > 10%, orphaned payment count > 0, and circuit breaker open events.

---

## Conclusion

The x402 protocol is a genuinely useful piece of infrastructure. It solves a real problem that HTTP has needed solved for thirty years -- embedding payment directly into the request-response cycle. The design is elegant: stateless, web-native, and simple enough that AI agents can interact with it without custom wallet integrations or complex payment orchestration. The protocol has processed over 100 million payments, and the developer experience for the happy path is genuinely excellent. You can go from zero to paid API in under an hour.

But the happy path is not where production systems live. Production systems live in the gap between a facilitator's 5-second timeout and a blockchain's 14-second confirmation. They live in the undocumented requirement to name USDC as "USD Coin." They live in the 1-second delay you need between signing and settlement that no documentation mentions.

These are solvable problems. The three solutions in this article -- network-aware timeouts, a settlement state machine, and a payment guardian layer -- address them at increasing levels of sophistication. For most deployments, Solution 1 (adjusting timeouts and adding delays) will eliminate the majority of failures. For high-volume or high-value deployments, Solution 2 (the state machine) eliminates the orphaned payment risk entirely.

The x402 ecosystem is early. The specification is evolving. [Issue #651](https://github.com/coinbase/x402/issues/651) proposes configurable timeouts in the Python SDK. [Issue #646](https://github.com/coinbase/x402/issues/646) discusses deadline validation. Base itself is rolling out Flashblocks on testnet, which would reduce block times to 200ms and largely eliminate the timeout problem at the network level.

In the meantime, do not deploy x402 without understanding what happens when settlement takes longer than the facilitator expects. The protocol is sound. The infrastructure is maturing. But the gap between "works in development" and "works in production" is measured in edge cases -- and the edge cases documented here will find you before you find them. Your agent's wallet depends on it.

---

*Have questions about x402 settlement issues or need help debugging payment failures? Find me on X [@bayc2043](https://x.com/bayc2043) or check out [PaySentry](https://github.com/paysentry/paysentry), an open-source control plane for AI agent payments that handles circuit breaking, retry classification, and settlement recovery out of the box.*
