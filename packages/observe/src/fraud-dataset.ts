// =============================================================================
// Labeled INR payment set for held-out fraud-spike evaluation.
// Synthetic, defense-only. Seeded so metrics are reproducible.
// =============================================================================

import type { PaymentFeatures } from './fraud-spike.js';

export interface LabeledPayment {
  readonly features: PaymentFeatures;
  /** 1 = fraud spike / abuse, 0 = legitimate merchant traffic */
  readonly label: 0 | 1;
  readonly note: string;
}

export const EVAL_MERCHANTS = [
  { id: 'merchant-cafe-01', name: 'Third Wave Coffee', city: 'Bengaluru' },
  { id: 'merchant-electronics-02', name: 'Croma Digital', city: 'Mumbai' },
  { id: 'merchant-d2c-03', name: 'Bombay Shirt Company', city: 'Delhi' },
] as const;

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

function isoIST(dayOffset: number, hour: number, minute: number, second = 0): string {
  const base = Date.UTC(2026, 7, 1, 0, 0, 0) - 330 * 60 * 1000;
  return new Date(base + dayOffset * 86400000 + hour * 3600000 + minute * 60000 + second * 1000).toISOString();
}

function vpa(rand: () => number, name: string): string {
  const banks = ['okaxis', 'ybl', 'ibl', 'okhdfcbank'];
  return `${name}${Math.floor(rand() * 90 + 10)}@${pick(rand, banks)}`;
}

/**
 * 300 labeled INR payments spanning ~14 IST days.
 * Includes an honest jewelry false-positive candidate and stealth fraud.
 */
export function generateFraudDataset(seed = 42): LabeledPayment[] {
  const rand = mulberry32(seed);
  const rows: LabeledPayment[] = [];

  const cafeCustomers = ['rahul.nair', 'isha.mehra', 'arjun.rao', 'meera.k', 'dev.patel'];
  const elecCustomers = ['neha.sharma', 'vikram.i', 'pooja.nair', 'karthik.s'];
  const d2cCustomers = ['ananya.b', 'rohan.gupta', 'sanya.j'];
  const cafeDevice = 'fp-cafe-pos-01';
  const elecDevice = 'fp-croma-web-02';
  const d2cDevice = 'fp-d2c-app-03';

  for (let i = 0; i < 90; i += 1) {
    const day = Math.floor(i / 8);
    const hour = 8 + (i % 10);
    rows.push({
      label: 0,
      note: 'Baseline cafe UPI',
      features: {
        merchantId: 'merchant-cafe-01',
        beneficiary: vpa(rand, pick(rand, cafeCustomers)),
        amount: Math.round(90 + rand() * 320),
        currency: 'INR',
        method: 'upi',
        timestamp: isoIST(day, hour, Math.floor(rand() * 50), i % 40),
        deviceFingerprint: cafeDevice,
      },
    });
  }

  for (let i = 0; i < 70; i += 1) {
    const day = Math.floor(i / 6);
    rows.push({
      label: 0,
      note: 'Baseline electronics card',
      features: {
        merchantId: 'merchant-electronics-02',
        beneficiary: vpa(rand, pick(rand, elecCustomers)),
        amount: Math.round(1800 + rand() * 12000),
        currency: 'INR',
        method: rand() > 0.35 ? 'card' : 'upi',
        timestamp: isoIST(day, 11 + (i % 8), Math.floor(rand() * 45)),
        deviceFingerprint: elecDevice,
        cardPresent: true,
      },
    });
  }

  for (let i = 0; i < 50; i += 1) {
    rows.push({
      label: 0,
      note: 'Baseline D2C checkout',
      features: {
        merchantId: 'merchant-d2c-03',
        beneficiary: vpa(rand, pick(rand, d2cCustomers)),
        amount: Math.round(799 + rand() * 2400),
        currency: 'INR',
        method: 'upi',
        timestamp: isoIST(Math.floor(i / 5), 10 + (i % 9), Math.floor(rand() * 40)),
        deviceFingerprint: d2cDevice,
      },
    });
  }

  for (let i = 0; i < 15; i += 1) {
    rows.push({
      label: 0,
      note: 'Legitimate festival / wedding jewelry — looks like a mule payout',
      features: {
        merchantId: 'merchant-electronics-02',
        beneficiary: vpa(rand, `wedding.gold${i}`),
        amount: Math.round(45000 + rand() * 35000),
        currency: 'INR',
        method: 'upi',
        timestamp: isoIST(12, i % 4, 10 + i),
        deviceFingerprint: `fp-wedding-${i}`,
      },
    });
  }

  const burstVpa = 'unknown.sink99@okaxis';
  for (let i = 0; i < 12; i += 1) {
    rows.push({
      label: 1,
      note: 'UPI velocity burst to a single sink VPA',
      features: {
        merchantId: 'merchant-cafe-01',
        beneficiary: burstVpa,
        amount: Math.round(400 + rand() * 200),
        currency: 'INR',
        method: 'upi',
        timestamp: isoIST(10, 2, 0, i * 4),
        deviceFingerprint: 'fp-unknown-burst',
      },
    });
  }

  for (let i = 0; i < 18; i += 1) {
    rows.push({
      label: 1,
      note: 'High-value payout to a brand-new beneficiary',
      features: {
        merchantId: 'merchant-d2c-03',
        beneficiary: `mule${i}x@ybl`,
        amount: Math.round(18000 + rand() * 22000),
        currency: 'INR',
        method: 'upi',
        timestamp: isoIST(11, 1 + (i % 3), 5 + i),
        deviceFingerprint: `fp-mule-${i}`,
      },
    });
  }

  for (let i = 0; i < 15; i += 1) {
    rows.push({
      label: 1,
      note: 'CNP high-ticket after credential testing',
      features: {
        merchantId: 'merchant-electronics-02',
        beneficiary: `stolen.card${i}@ibl`,
        amount: Math.round(9000 + rand() * 16000),
        currency: 'INR',
        method: 'card',
        timestamp: isoIST(11, 14, i * 2),
        deviceFingerprint: `fp-cnp-${i}`,
        cardPresent: false,
        recentFailCount: 3 + (i % 3),
      },
    });
  }

  for (let i = 0; i < 15; i += 1) {
    rows.push({
      label: 1,
      note: 'Night UPI drain on cafe MID',
      features: {
        merchantId: 'merchant-cafe-01',
        beneficiary: `night.drain${i}@okhdfcbank`,
        amount: Math.round(700 + rand() * 900),
        currency: 'INR',
        method: 'upi',
        timestamp: isoIST(13, i % 4, 20 + i),
        deviceFingerprint: `fp-night-${i}`,
      },
    });
  }

  for (let i = 0; i < 15; i += 1) {
    rows.push({
      label: 1,
      note: 'Stealth fraud — slow, daytime, moderate ticket (expected misses)',
      features: {
        merchantId: 'merchant-d2c-03',
        beneficiary: vpa(rand, pick(rand, d2cCustomers)),
        amount: Math.round(1200 + rand() * 800),
        currency: 'INR',
        method: 'upi',
        timestamp: isoIST(8 + (i % 4), 13, 10 + i * 3),
        deviceFingerprint: d2cDevice,
      },
    });
  }

  rows.sort((a, b) => a.features.timestamp.localeCompare(b.features.timestamp));
  return rows;
}

export function splitTrainTest<T>(rows: readonly T[], trainRatio = 0.8): { train: T[]; test: T[] } {
  const cut = Math.floor(rows.length * trainRatio);
  return { train: rows.slice(0, cut) as T[], test: rows.slice(cut) as T[] };
}
