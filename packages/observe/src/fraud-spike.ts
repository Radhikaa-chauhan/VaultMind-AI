// =============================================================================
// FraudSpikeScorer — explainable detector for one loss class: payment fraud spikes
// Deterministic feature weights. PolicyEngine still owns hard blocks.
// =============================================================================

export type PaymentMethod = 'upi' | 'card' | 'netbanking';
export type RiskAction = 'allow' | 'flag' | 'block';

export interface PaymentFeatures {
  readonly merchantId: string;
  readonly beneficiary: string;
  readonly amount: number;
  readonly currency: string;
  readonly method: PaymentMethod;
  readonly timestamp: string;
  readonly deviceFingerprint?: string;
  readonly cardPresent?: boolean;
  readonly recentFailCount?: number;
}

export interface RiskScore {
  readonly score: number;
  readonly action: RiskAction;
  readonly reasons: readonly string[];
  readonly features: Readonly<Record<string, number>>;
}

export const FLAG_THRESHOLD = 42;
export const BLOCK_THRESHOLD = 72;

interface MerchantState {
  amounts: number[];
  timestamps: number[];
  devices: Set<string>;
  beneficiaries: Set<string>;
}

function istHour(iso: string): number {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 12;
  const utcHour = date.getUTCHours();
  const utcMin = date.getUTCMinutes();
  const istMinutes = (utcHour * 60 + utcMin + 330) % (24 * 60);
  return Math.floor(istMinutes / 60);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function countSince(timestamps: number[], now: number, windowMs: number): number {
  const from = now - windowMs;
  let count = 0;
  for (const t of timestamps) {
    if (t >= from && t <= now) count += 1;
  }
  return count;
}

/**
 * Explainable fraud-spike scorer. Call score() then observe() so evaluation
 * can stay leakage-free (features only see prior history).
 */
export class FraudSpikeScorer {
  private readonly merchants = new Map<string, MerchantState>();
  private readonly beneficiaryTimes = new Map<string, number[]>();

  reset(): void {
    this.merchants.clear();
    this.beneficiaryTimes.clear();
  }

  score(payment: PaymentFeatures): RiskScore {
    const now = new Date(payment.timestamp).getTime();
    const merchant = this.merchants.get(payment.merchantId);
    const priorAmounts = merchant?.amounts ?? [];
    const merchantTimes = merchant?.timestamps ?? [];
    const beneficiaryTimes = this.beneficiaryTimes.get(payment.beneficiary) ?? [];

    const vel60 = countSince(merchantTimes, now, 60_000) + 1;
    const vel5m = countSince(beneficiaryTimes, now, 5 * 60_000) + 1;
    const avg = mean(priorAmounts);
    const sd = stddev(priorAmounts);
    const z = sd > 0 ? (payment.amount - avg) / sd : 0;
    const newBeneficiary = merchant ? !merchant.beneficiaries.has(payment.beneficiary) : true;
    const newDevice = payment.deviceFingerprint
      ? merchant
        ? !merchant.devices.has(payment.deviceFingerprint)
        : true
      : false;
    const hour = istHour(payment.timestamp);
    const nightUpi = payment.method === 'upi' && hour >= 0 && hour < 5;
    const cnpHigh = payment.method === 'card' && payment.cardPresent === false && payment.amount >= 8000;
    const failThenWin = (payment.recentFailCount ?? 0) >= 3;
    const muleShape = newBeneficiary && payment.amount >= 15000;

    const features: Record<string, number> = {
      velocity_60s: vel60,
      velocity_beneficiary_5m: vel5m,
      amount_z: Number(z.toFixed(2)),
      new_beneficiary: newBeneficiary ? 1 : 0,
      new_device: newDevice ? 1 : 0,
      night_upi: nightUpi ? 1 : 0,
      cnp_high_ticket: cnpHigh ? 1 : 0,
      credential_test: failThenWin ? 1 : 0,
      mule_shape: muleShape ? 1 : 0,
    };

    let score = 0;
    const reasons: string[] = [];

    if (vel60 >= 6) {
      score += 28;
      reasons.push(`Merchant velocity ${vel60} payments in 60s`);
    } else if (vel60 >= 4) {
      score += 18;
      reasons.push(`Merchant velocity ${vel60} payments in 60s`);
    }

    if (vel5m >= 3) {
      score += 16;
      reasons.push(`Same beneficiary hit ${vel5m} times in 5 minutes`);
    }

    if (z > 4) {
      score += 22;
      reasons.push(`Amount ₹${payment.amount.toFixed(0)} is ${z.toFixed(1)}σ above merchant mean`);
    } else if (z > 2.5) {
      score += 12;
      reasons.push(`Amount ₹${payment.amount.toFixed(0)} is ${z.toFixed(1)}σ above merchant mean`);
    }

    if (newBeneficiary) {
      score += 10;
      reasons.push('First payment to this beneficiary for the merchant');
    }

    if (newDevice) {
      score += 8;
      reasons.push('Unrecognized device fingerprint');
    }

    if (nightUpi) {
      score += 14;
      reasons.push(`UPI at ${String(hour).padStart(2, '0')}:00 IST (quiet hours)`);
    }

    if (cnpHigh) {
      score += 20;
      reasons.push('Card-not-present ticket above ₹8,000');
    }

    if (failThenWin) {
      score += 24;
      reasons.push(`${payment.recentFailCount} recent failures then a success — credential testing`);
    }

    if (muleShape) {
      score += 18;
      reasons.push('New beneficiary plus high-value payout (mule pattern)');
    }

    score = Math.min(100, Math.round(score));
    const action: RiskAction =
      score >= BLOCK_THRESHOLD ? 'block' : score >= FLAG_THRESHOLD ? 'flag' : 'allow';

    return { score, action, reasons, features };
  }

  observe(payment: PaymentFeatures): void {
    const now = new Date(payment.timestamp).getTime();
    let merchant = this.merchants.get(payment.merchantId);
    if (!merchant) {
      merchant = { amounts: [], timestamps: [], devices: new Set(), beneficiaries: new Set() };
      this.merchants.set(payment.merchantId, merchant);
    }
    merchant.amounts.push(payment.amount);
    if (merchant.amounts.length > 200) merchant.amounts.shift();
    merchant.timestamps.push(now);
    if (merchant.timestamps.length > 400) merchant.timestamps.shift();
    merchant.beneficiaries.add(payment.beneficiary);
    if (payment.deviceFingerprint) merchant.devices.add(payment.deviceFingerprint);

    const times = this.beneficiaryTimes.get(payment.beneficiary) ?? [];
    times.push(now);
    if (times.length > 200) times.shift();
    this.beneficiaryTimes.set(payment.beneficiary, times);
  }

  scoreAndObserve(payment: PaymentFeatures): RiskScore {
    const result = this.score(payment);
    this.observe(payment);
    return result;
  }
}

export function featuresFromMetadata(
  merchantId: string,
  beneficiary: string,
  amount: number,
  currency: string,
  metadata: Readonly<Record<string, unknown>> | undefined,
  timestamp?: string,
): PaymentFeatures {
  const methodRaw = metadata?.method;
  const method: PaymentMethod =
    methodRaw === 'card' || methodRaw === 'netbanking' || methodRaw === 'upi' ? methodRaw : 'upi';

  return {
    merchantId,
    beneficiary,
    amount,
    currency,
    method,
    timestamp: timestamp ?? (typeof metadata?.timestamp === 'string' ? metadata.timestamp : new Date().toISOString()),
    deviceFingerprint: typeof metadata?.deviceFingerprint === 'string' ? metadata.deviceFingerprint : undefined,
    cardPresent: typeof metadata?.cardPresent === 'boolean' ? metadata.cardPresent : undefined,
    recentFailCount: typeof metadata?.recentFailCount === 'number' ? metadata.recentFailCount : undefined,
  };
}
