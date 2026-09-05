// =============================================================================
// PaySentryStack — bundles all PaySentry components into a single interface
// Enhanced from the example: adds policy CRUD, dispute management, provenance
// =============================================================================

import type {
  AgentId,
  AgentTransaction,
  PolicyId,
  TransactionId,
  SpendAlert,
  SpendPolicy,
  PolicyEvaluation,
  DisputeCase,
  ProvenanceRecord,
} from '@vaultmind/core';
import { createTransaction, EventBus, JsonSnapshotStore, generateId } from '@vaultmind/core';
import {
  PolicyEngine,
  blockAbove,
  requireApprovalAbove,
  allowAll,
} from '@vaultmind/control';
import {
  SpendTracker,
  SpendAlerts,
  SpendAnalytics,
  FraudSpikeScorer,
  featuresFromMetadata,
} from '@vaultmind/observe';
import { MockX402 } from '@vaultmind/sandbox';
import { TransactionProvenance, DisputeManager } from '@vaultmind/protect';
import { AgentRegistry } from '@vaultmind/a2a';

import type { McpServerConfig, WalletState, PaymentResult, ProcessPaymentOptions } from './types.js';

export interface StackSnapshot {
  readonly transactions: AgentTransaction[];
  readonly alerts: SpendAlert[];
  readonly policies: SpendPolicy[];
}

export interface VaultMindStackOptions {
  readonly persistPath?: string;
}

export class VaultMindStack {
  readonly policyEngine: PolicyEngine;
  readonly tracker: SpendTracker;
  readonly alerts: SpendAlerts;
  readonly analytics: SpendAnalytics;
  readonly mockPayment: MockX402;
  readonly provenance: TransactionProvenance;
  readonly disputes: DisputeManager;
  readonly events: EventBus;
  readonly wallet: WalletState;
  readonly config: McpServerConfig;
  readonly registry: AgentRegistry;
  readonly scorer: FraudSpikeScorer;

  private static readonly MAX_ALERT_LOG = 500;
  private readonly alertLog: SpendAlert[] = [];
  private readonly persist?: JsonSnapshotStore<StackSnapshot>;

  constructor(config: McpServerConfig, options?: VaultMindStackOptions) {
    this.config = config;
    this.events = new EventBus();
    this.registry = new AgentRegistry();
    this.scorer = new FraudSpikeScorer();
    this.persist = options?.persistPath ? new JsonSnapshotStore<StackSnapshot>(options.persistPath) : undefined;

    // Observe
    this.tracker = new SpendTracker();
    this.analytics = new SpendAnalytics(this.tracker);
    this.alerts = new SpendAlerts(this.tracker);
    this.setupAlerts(config);

    // Control
    this.policyEngine = new PolicyEngine();
    this.setupDefaultPolicy(config);

    // Protect
    this.provenance = new TransactionProvenance();
    this.disputes = new DisputeManager();

    // Sandbox
    this.mockPayment = new MockX402({
      latencyMs: config.sandbox.latencyMs,
      failureRate: config.sandbox.failureRate,
      supportedCurrencies: [config.policy.currency],
    });

    // Wallet
    this.wallet = {
      balance: config.sandbox.initialBalance,
      currency: config.policy.currency,
      totalSpent: 0,
      transactionCount: 0,
    };

    // Wire up alerts to event bus
    this.alerts.onAlert((alert) => {
      this.alertLog.push(alert);
      if (this.alertLog.length > VaultMindStack.MAX_ALERT_LOG) {
        this.alertLog.splice(0, this.alertLog.length - VaultMindStack.MAX_ALERT_LOG);
      }
      this.events.emit({ type: 'alert.fired', alert });
    });
  }

  // ---------------------------------------------------------------------------
  // Payment pipeline
  // ---------------------------------------------------------------------------

  async processPayment(
    recipient: string,
    amount: number,
    currency: string,
    reason: string,
    agentId?: string,
    options?: ProcessPaymentOptions,
  ): Promise<PaymentResult> {
    const agent = (agentId ?? this.config.defaultAgentId) as AgentId;
    const applyRisk = options?.applyRiskScore === true;
    const features = applyRisk
      ? featuresFromMetadata(agent, recipient, amount, currency, options?.metadata)
      : undefined;
    const risk = features ? this.scorer.score(features) : undefined;
    if (features) this.scorer.observe(features);

    const tx = createTransaction({
      agentId: agent,
      recipient,
      amount,
      currency,
      purpose: reason,
      protocol: options?.protocol ?? 'x402',
      metadata: {
        ...(options?.metadata ?? {}),
        ...(risk
          ? {
              riskScore: risk.score,
              riskAction: risk.action,
              riskReasons: risk.reasons,
            }
          : {}),
      },
    });

    this.events.emit({ type: 'transaction.created', transaction: tx });

    // Record intent provenance
    this.provenance.recordIntent(tx, { reason, agentId: agent });

    // Policy evaluation
    const evaluation = this.policyEngine.evaluate(tx);

    this.events.emit({ type: 'policy.evaluated', transaction: tx, evaluation });
    this.provenance.recordPolicyCheck(
      tx.id,
      evaluation.allowed ? 'pass' : 'fail',
      { action: evaluation.action, reason: evaluation.reason, rule: evaluation.triggeredRule?.name },
    );

    const scorerBlocks = applyRisk && risk?.action === 'block';
    if (evaluation.action === 'deny' || scorerBlocks) {
      const reasonText = evaluation.action === 'deny'
        ? evaluation.reason
        : `Fraud-spike score ${risk?.score} — ${risk?.reasons[0] ?? 'high-risk pattern'}`;
      tx.status = 'rejected';
      this.tracker.record(tx);
      this.registry.updateTrustScore(agent, 'failed');
      this.persistSnapshot();
      this.events.emit({ type: 'transaction.denied', transaction: tx, reason: reasonText });
      return {
        success: false,
        transactionId: tx.id,
        status: 'blocked',
        message: `Payment blocked: ${reasonText}`,
        policyDetails: { action: 'deny', reason: reasonText, triggeredRule: evaluation.triggeredRule?.name },
        risk: risk ? { score: risk.score, action: risk.action, reasons: risk.reasons } : undefined,
      };
    }

    if (evaluation.action === 'require_approval') {
      tx.status = 'pending';
      this.tracker.record(tx);
      return {
        success: false,
        transactionId: tx.id,
        status: 'requires_approval',
        message: `Payment requires human approval: ${evaluation.reason}. Transaction ID: ${tx.id}`,
        policyDetails: { action: evaluation.action, reason: evaluation.reason, triggeredRule: evaluation.triggeredRule?.name },
      };
    }

    // Balance check
    if (amount > this.wallet.balance) {
      tx.status = 'failed';
      this.tracker.record(tx);
      this.events.emit({ type: 'transaction.failed', transaction: tx, error: 'insufficient_balance' });
      return {
        success: false,
        transactionId: tx.id,
        status: 'blocked',
        message: `Insufficient balance: $${this.wallet.balance.toFixed(2)} available, $${amount.toFixed(2)} required`,
      };
    }

    // Merchant rails (UPI/card) are not x402 HTTP URLs — settle without the URL check.
    const paymentResult = tx.protocol === 'custom'
      ? { success: true as const, txId: generateId('rzp') }
      : await this.mockPayment.processPayment(tx);

    if (!paymentResult.success) {
      tx.status = 'failed';
      this.tracker.record(tx);
      this.events.emit({ type: 'transaction.failed', transaction: tx, error: paymentResult.error ?? 'execution_failed' });
      return {
        success: false,
        transactionId: tx.id,
        status: 'blocked',
        message: `Payment execution failed: ${paymentResult.error}`,
      };
    }

    // Success
    tx.status = 'completed';
    tx.protocolTxId = paymentResult.txId;
    tx.updatedAt = new Date().toISOString();

    this.wallet.balance -= amount;
    this.wallet.totalSpent += amount;
    this.wallet.transactionCount++;

    this.tracker.record(tx);
    this.policyEngine.recordTransaction(tx);

    this.provenance.recordSettlement(tx.id, 'pass', { protocolTxId: paymentResult.txId });

    this.registry.recordSpend(agent, amount);
    this.registry.updateTrustScore(agent, 'completed');
    this.events.emit({ type: 'transaction.completed', transaction: tx });

    // Evaluate alerts
    const triggeredAlerts = await this.alerts.evaluate(tx);
    const alertMessages = triggeredAlerts.map((a) => `[${a.severity}] ${a.message}`);
    this.persistSnapshot();

    return {
      success: true,
      transactionId: tx.id,
      status: 'completed',
      message: `Payment of $${amount.toFixed(2)} ${currency} to ${recipient} completed. TX: ${paymentResult.txId}`,
      policyDetails: { action: evaluation.action, reason: evaluation.reason },
      alerts: alertMessages.length > 0 ? alertMessages : undefined,
      risk: risk ? { score: risk.score, action: risk.action, reasons: risk.reasons } : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Balance & analytics
  // ---------------------------------------------------------------------------

  getBalanceInfo() {
    const policy = this.policyEngine.getPolicies()[0];
    const dailyBudget = policy?.budgets.find((b) => b.window === 'daily');
    const dailySpend = dailyBudget ? this.policyEngine.getCurrentSpend(policy!.id, dailyBudget) : { amount: 0 };
    const hourlyBudget = policy?.budgets.find((b) => b.window === 'hourly');
    const hourlySpend = hourlyBudget ? this.policyEngine.getCurrentSpend(policy!.id, hourlyBudget) : { amount: 0 };

    return {
      balance: this.wallet.balance,
      currency: this.wallet.currency,
      totalSpent: this.wallet.totalSpent,
      transactionCount: this.wallet.transactionCount,
      dailyBudget: { used: dailySpend.amount, limit: this.config.policy.maxDaily, remaining: Math.max(0, this.config.policy.maxDaily - dailySpend.amount) },
      hourlyBudget: { used: hourlySpend.amount, limit: this.config.policy.maxHourly, remaining: Math.max(0, this.config.policy.maxHourly - hourlySpend.amount) },
    };
  }

  getPaymentHistory(limit?: number, agentId?: string) {
    const filter: { agentId?: AgentId; limit?: number } = {};
    if (agentId) filter.agentId = agentId as AgentId;
    if (limit) filter.limit = limit;
    const txs = this.tracker.query(filter);
    return {
      transactions: txs.map((tx) => ({
        id: tx.id, recipient: tx.recipient, amount: tx.amount,
        currency: tx.currency, purpose: tx.purpose, status: tx.status,
        createdAt: tx.createdAt, protocolTxId: tx.protocolTxId,
      })),
      totalCount: this.tracker.size,
    };
  }

  // ---------------------------------------------------------------------------
  // Policy CRUD
  // ---------------------------------------------------------------------------

  listPolicies(): SpendPolicy[] {
    return this.policyEngine.getPolicies();
  }

  getPolicy(policyId: string): SpendPolicy | undefined {
    return this.policyEngine.getPolicies().find((p) => p.id === policyId);
  }

  createPolicy(policy: SpendPolicy): void {
    this.policyEngine.loadPolicy(policy);
    this.events.emit({ type: 'policy.loaded', policyId: policy.id });
  }

  removePolicy(policyId: string): boolean {
    const exists = this.getPolicy(policyId);
    if (exists) {
      this.policyEngine.removePolicy(policyId as PolicyId);
      this.events.emit({ type: 'policy.removed', policyId: policyId as PolicyId });
      return true;
    }
    return false;
  }

  evaluateDryRun(recipient: string, amount: number, currency: string): PolicyEvaluation {
    const tx = createTransaction({
      agentId: this.config.defaultAgentId,
      recipient,
      amount,
      currency,
      purpose: 'dry-run evaluation',
      protocol: 'x402',
    });
    return this.policyEngine.evaluate(tx);
  }

  // ---------------------------------------------------------------------------
  // Disputes
  // ---------------------------------------------------------------------------

  fileDispute(transactionId: string, reason: string): DisputeCase {
    const txId = transactionId as TransactionId;
    const tx = this.tracker.get(txId);
    const dispute = this.disputes.file({
      transactionId: txId,
      agentId: tx?.agentId ?? this.config.defaultAgentId,
      reason,
      requestedAmount: tx?.amount ?? 0,
    });
    this.events.emit({ type: 'dispute.opened', dispute });
    return dispute;
  }

  listDisputes(status?: string): DisputeCase[] {
    return this.disputes.query(status ? { status: status as DisputeCase['status'] } : {});
  }

  // ---------------------------------------------------------------------------
  // Provenance
  // ---------------------------------------------------------------------------

  getAuditTrail(transactionId: string): readonly ProvenanceRecord[] {
    return this.provenance.getChain(transactionId as TransactionId);
  }

  // ---------------------------------------------------------------------------
  // Alerts
  // ---------------------------------------------------------------------------

  getAlertLog(): SpendAlert[] {
    return [...this.alertLog];
  }

  // ---------------------------------------------------------------------------
  // Private setup
  // ---------------------------------------------------------------------------

  private setupDefaultPolicy(config: McpServerConfig): void {
    this.policyEngine.loadPolicy({
      id: config.policy.id,
      name: 'Default Agent Payment Policy',
      description: 'Auto-configured spending controls',
      enabled: true,
      rules: [
        blockAbove(config.policy.maxPerTransaction, config.policy.currency),
        requireApprovalAbove(config.policy.approvalThreshold, config.policy.currency),
        allowAll(),
      ],
      budgets: [
        { window: 'daily', maxAmount: config.policy.maxDaily, currency: config.policy.currency },
        { window: 'hourly', maxAmount: config.policy.maxHourly, currency: config.policy.currency },
      ],
    });
  }

  private setupAlerts(config: McpServerConfig): void {
    this.alerts.addRule({
      id: 'large-tx', name: 'Large Transaction', type: 'large_transaction',
      severity: 'warning', enabled: true,
      config: { type: 'large_transaction', threshold: config.alerts.largeTransactionThreshold, currency: config.alerts.currency },
    });
    this.alerts.addRule({
      id: 'rate-spike', name: 'Rate Spike', type: 'rate_spike',
      severity: 'critical', enabled: true,
      config: { type: 'rate_spike', maxTransactions: config.alerts.rateSpikeMaxPerMinute, windowMs: 60_000 },
    });
    this.alerts.addRule({
      id: 'new-recipient', name: 'New Recipient', type: 'new_recipient',
      severity: 'info', enabled: true,
      config: { type: 'new_recipient' },
    });
  }

  private persistSnapshot(): void {
    if (!this.persist) return;
    try {
      this.persist.save({
        transactions: this.tracker.query({ limit: 1000 }),
        alerts: this.getAlertLog(),
        policies: this.policyEngine.getPolicies(),
      });
    } catch {
      // Persistence must never break the payment path
    }
  }
}

/** @deprecated Use VaultMindStack */
export { VaultMindStack as PaySentryStack };

// Default config
export const DEFAULT_CONFIG: McpServerConfig = {
  serverName: 'paysentry-mcp',
  serverVersion: '1.0.0',
  defaultAgentId: 'mcp-agent' as AgentId,
  policy: {
    id: 'mcp-default' as PolicyId,
    maxPerTransaction: 100,
    maxDaily: 500,
    maxHourly: 200,
    approvalThreshold: 50,
    currency: 'USD',
  },
  alerts: {
    largeTransactionThreshold: 50,
    rateSpikeMaxPerMinute: 5,
    currency: 'USD',
  },
  sandbox: {
    latencyMs: 50,
    failureRate: 0,
    initialBalance: 10000,
  },
};
