/**
 * Held-out evaluation for the VaultMind fraud-spike detector.
 * Prints precision, recall, F1, and false-positive cost in INR.
 */

import { evaluateFraudSpike } from '@vaultmind/observe';

const report = evaluateFraudSpike();

process.stdout.write('\nVaultMind AI — fraud-spike held-out metrics\n');
process.stdout.write('==========================================\n');
process.stdout.write(`Dataset: ${report.datasetSize}  train: ${report.trainSize}  test: ${report.testSize}\n`);
process.stdout.write(`Thresholds: flag ≥ ${report.thresholds.flag}  block ≥ ${report.thresholds.block}\n\n`);
process.stdout.write(`Detection  P=${report.detection.precision}  R=${report.detection.recall}  F1=${report.detection.f1}\n`);
process.stdout.write(`Confusion  TP=${report.detection.confusion.truePositive} FP=${report.detection.confusion.falsePositive} TN=${report.detection.confusion.trueNegative} FN=${report.detection.confusion.falseNegative}\n\n`);
process.stdout.write(`Blocking   P=${report.blocking.precision}  R=${report.blocking.recall}\n`);
process.stdout.write(`FP cost    ₹${report.blocking.falsePositiveCostInr.toLocaleString('en-IN')}  (${report.blocking.falsePositiveCount} blocked legit payments)\n`);
process.stdout.write(`Missed     ₹${report.blocking.missedFraudInr.toLocaleString('en-IN')}\n\n`);
for (const note of report.notes) {
  process.stdout.write(`- ${note}\n`);
}
process.stdout.write('\n');
