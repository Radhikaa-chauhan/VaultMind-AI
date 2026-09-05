export type Page =
  | 'overview'
  | 'payments'
  | 'rules'
  | 'merchants'
  | 'alerts'
  | 'chargebacks'
  | 'model';

export interface Payment {
  id: string;
  agentId: string;
  recipient: string;
  amount: number;
  currency: string;
  purpose: string;
  protocol: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface AlertItem {
  type: string;
  severity: string;
  message: string;
  timestamp: string;
  agentId?: string;
  transactionId?: string;
}

export interface Policy {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  rules: Array<{ id: string; name: string; action: string; enabled: boolean }>;
  budgets: Array<{ window: string; maxAmount: number; currency?: string }>;
}

export interface Merchant {
  id: string;
  name: string;
  trustScore: number;
  totalSpent: number;
  metadata?: Record<string, unknown>;
}

export interface Dispute {
  id: string;
  transactionId: string;
  agentId: string;
  reason: string;
  status: string;
  requestedAmount: number;
  createdAt: string;
}

export interface Stats {
  totalTransactions: number;
  completed: number;
  blocked: number;
  flagged: number;
  completedInr: number;
  blockedInr: number;
  flaggedInr: number;
  merchants: number;
  openDisputes: number;
  risk: { score: number; factors: Record<string, number> };
  hours: Array<{ hour: string; allowed: number; blocked: number; allowedAmount: number; blockedAmount: number }>;
}

export interface EvalMetrics {
  lossClass: string;
  defenseOnly: boolean;
  datasetSize: number;
  trainSize: number;
  testSize: number;
  thresholds: { flag: number; block: number };
  detection: {
    precision: number;
    recall: number;
    f1: number;
    confusion: { truePositive: number; falsePositive: number; trueNegative: number; falseNegative: number };
  };
  blocking: {
    precision: number;
    recall: number;
    falsePositiveCostInr: number;
    falsePositiveCount: number;
    missedFraudInr: number;
  };
  notes: string[];
}

export interface LiveEvent {
  type: string;
  receivedAt: string;
  raw: Record<string, unknown>;
}
