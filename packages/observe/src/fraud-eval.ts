// =============================================================================
// Held-out evaluation for FraudSpikeScorer
// Precision, recall, F1, and false-positive cost in INR (blocked good GMV)
// =============================================================================

import { FraudSpikeScorer, FLAG_THRESHOLD, BLOCK_THRESHOLD, type RiskAction } from './fraud-spike.js';
import { generateFraudDataset, splitTrainTest, type LabeledPayment } from './fraud-dataset.js';

export interface ConfusionCounts {
  readonly truePositive: number;
  readonly falsePositive: number;
  readonly trueNegative: number;
  readonly falseNegative: number;
}

export interface FraudEvalReport {
  readonly lossClass: 'fraud_spike';
  readonly defenseOnly: true;
  readonly datasetSize: number;
  readonly trainSize: number;
  readonly testSize: number;
  readonly thresholds: { readonly flag: number; readonly block: number };
  readonly detection: {
    readonly precision: number;
    readonly recall: number;
    readonly f1: number;
    readonly confusion: ConfusionCounts;
  };
  readonly blocking: {
    readonly precision: number;
    readonly recall: number;
    readonly falsePositiveCostInr: number;
    readonly falsePositiveCount: number;
    readonly missedFraudInr: number;
  };
  readonly notes: readonly string[];
}

function isPositive(action: RiskAction, mode: 'detect' | 'block'): boolean {
  if (mode === 'block') return action === 'block';
  return action === 'flag' || action === 'block';
}

function safeDiv(n: number, d: number): number {
  return d === 0 ? 0 : n / d;
}

function round4(n: number): number {
  return Number(n.toFixed(4));
}

function emptyConfusion(): { truePositive: number; falsePositive: number; trueNegative: number; falseNegative: number } {
  return { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 };
}

function evaluateSlice(rows: readonly LabeledPayment[], scorer: FraudSpikeScorer, observe: boolean) {
  const detect = emptyConfusion();
  const block = emptyConfusion();
  let fpCost = 0;
  let missed = 0;
  let fpCount = 0;

  for (const row of rows) {
    const scored = scorer.score(row.features);
    if (observe) scorer.observe(row.features);

    const detectPos = isPositive(scored.action, 'detect');
    const blockPos = isPositive(scored.action, 'block');

    if (row.label === 1 && detectPos) detect.truePositive += 1;
    else if (row.label === 0 && detectPos) detect.falsePositive += 1;
    else if (row.label === 0 && !detectPos) detect.trueNegative += 1;
    else detect.falseNegative += 1;

    if (row.label === 1 && blockPos) block.truePositive += 1;
    else if (row.label === 0 && blockPos) {
      block.falsePositive += 1;
      fpCost += row.features.amount;
      fpCount += 1;
    } else if (row.label === 0 && !blockPos) block.trueNegative += 1;
    else {
      block.falseNegative += 1;
      missed += row.features.amount;
    }
  }

  const precision = safeDiv(detect.truePositive, detect.truePositive + detect.falsePositive);
  const recall = safeDiv(detect.truePositive, detect.truePositive + detect.falseNegative);
  const f1 = safeDiv(2 * precision * recall, precision + recall);
  const blockPrecision = safeDiv(block.truePositive, block.truePositive + block.falsePositive);
  const blockRecall = safeDiv(block.truePositive, block.truePositive + block.falseNegative);

  return {
    detect,
    precision,
    recall,
    f1,
    blockPrecision,
    blockRecall,
    fpCost,
    fpCount,
    missed,
  };
}

/**
 * Train split is used only to warm the rolling windows (no learned weights).
 * Test split is scored after that warmup — the number we publish.
 */
export function evaluateFraudSpike(seed = 42): FraudEvalReport {
  const all = generateFraudDataset(seed);
  const { train, test } = splitTrainTest(all, 0.8);
  const scorer = new FraudSpikeScorer();

  for (const row of train) {
    scorer.observe(row.features);
  }

  const heldOut = evaluateSlice(test, scorer, true);

  return {
    lossClass: 'fraud_spike',
    defenseOnly: true,
    datasetSize: all.length,
    trainSize: train.length,
    testSize: test.length,
    thresholds: { flag: FLAG_THRESHOLD, block: BLOCK_THRESHOLD },
    detection: {
      precision: round4(heldOut.precision),
      recall: round4(heldOut.recall),
      f1: round4(heldOut.f1),
      confusion: heldOut.detect,
    },
    blocking: {
      precision: round4(heldOut.blockPrecision),
      recall: round4(heldOut.blockRecall),
      falsePositiveCostInr: Math.round(heldOut.fpCost),
      falsePositiveCount: heldOut.fpCount,
      missedFraudInr: Math.round(heldOut.missed),
    },
    notes: [
      'Positive class = fraud spike / abuse. Detection counts flag or block as a catch.',
      'False-positive cost is blocked legitimate GMV in INR (jewelry / festival tickets are the honest misshape).',
      'Stealth daytime drains are left in the set so recall is not 1.0.',
      'Weights are fixed and explainable. Train split only warms velocity windows.',
    ],
  };
}

let cached: FraudEvalReport | undefined;

export function getCachedFraudEval(): FraudEvalReport {
  if (!cached) cached = evaluateFraudSpike();
  return cached;
}
