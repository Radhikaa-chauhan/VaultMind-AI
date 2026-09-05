import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFraudSpike } from '../src/fraud-eval.js';
import { generateFraudDataset } from '../src/fraud-dataset.js';
import { FraudSpikeScorer as Scorer } from '../src/fraud-spike.js';

describe('FraudSpikeScorer', () => {
  it('scores a quiet cafe UPI as allow', () => {
    const scorer = new Scorer();
    const result = scorer.scoreAndObserve({
      merchantId: 'merchant-cafe-01',
      beneficiary: 'rahul@okaxis',
      amount: 160,
      currency: 'INR',
      method: 'upi',
      timestamp: '2026-08-01T04:30:00.000Z',
      deviceFingerprint: 'pos-1',
    });
    assert.equal(result.action, 'allow');
    assert.ok(result.score < 42);
  });

  it('flags a velocity burst to one sink', () => {
    const scorer = new Scorer();
    const t0 = Date.parse('2026-08-10T20:30:00.000Z');
    let last = { score: 0, action: 'allow' as const };
    for (let i = 0; i < 7; i += 1) {
      last = scorer.scoreAndObserve({
        merchantId: 'merchant-cafe-01',
        beneficiary: 'sink@okaxis',
        amount: 400,
        currency: 'INR',
        method: 'upi',
        timestamp: new Date(t0 + i * 4000).toISOString(),
        deviceFingerprint: 'burst',
      });
    }
    assert.ok(last.score >= 42);
  });

  it('publishes held-out metrics with a real test split', () => {
    const report = evaluateFraudSpike();
    assert.equal(report.lossClass, 'fraud_spike');
    assert.equal(report.defenseOnly, true);
    assert.ok(report.testSize >= 50);
    assert.ok(report.detection.precision >= 0 && report.detection.precision <= 1);
    assert.ok(report.detection.recall >= 0 && report.detection.recall <= 1);
    const all = generateFraudDataset();
    assert.equal(all.length, report.datasetSize);
    assert.ok(all.some((row) => row.note.includes('jewelry')));
  });
});
