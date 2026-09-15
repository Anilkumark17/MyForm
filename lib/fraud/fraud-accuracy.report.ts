/**
 * Prints fraud-detection accuracy metrics for README / CI.
 * Run: npm run test:fraud-accuracy
 */
import { evaluateFraudDetectionAccuracy } from "./eval-harness"

const m = evaluateFraudDetectionAccuracy()
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

console.log("")
console.log("Fraud detection accuracy report")
console.log("===============================")
console.log(`Labeled cases (post-baseline): ${m.total}`)
console.log(`  True positive  (fake caught):     ${m.tp}`)
console.log(`  True negative  (legit kept):      ${m.tn}`)
console.log(`  False positive (legit flagged):   ${m.fp}`)
console.log(`  False negative (fake missed):     ${m.fn}`)
console.log("")
console.log(`Accuracy:  ${pct(m.accuracy)}`)
console.log(`Precision: ${pct(m.precision)}`)
console.log(`Recall:    ${pct(m.recall)}`)
console.log(`F1 score:  ${pct(m.f1)}`)
console.log("")

if (m.failures.length) {
  console.log("Misclassifications:")
  for (const row of m.failures) console.log(`  - ${row}`)
  process.exitCode = 1
} else {
  console.log("No misclassifications on the labeled corpus.")
}
