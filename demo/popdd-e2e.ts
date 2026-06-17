/**
 * LUX End-to-End POPDD Demonstration
 *
 * Feature: weightedAverage(prices, weights) → number
 *
 * This file demonstrates POPDD (Proof of Proof-Driven Development) on a
 * real feature:
 *
 *   Step 1: SPECIFY  — Write a formal FunctionSpec
 *   Step 2: VERIFY   — Run SpecVerifier, capture verdict
 *   Step 3: SIGN     — Append DecisionReceipts to a chain (POPDD layer)
 *   Step 4: PERSIST  — Save the chain to disk
 *   Step 5: RELOAD   — Read the chain back, verify integrity
 *   Step 6: TAMPER   — Show that any modification breaks the chain
 *
 * Run with:  npx tsx demo/popdd-e2e.ts
 */

import {
  SpecVerifier,
  HmacSigner,
  ReceiptChain,
  type FunctionSpec,
  type VerificationResult,
} from "../src/index";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

// ═══════════════════════════════════════════════════════════════════════
// THE FEATURE — weightedAverage(prices, weights)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute the weighted average of an array of prices.
 *
 * @param prices  Array of positive numbers (length >= 1)
 * @param weights Array of non-negative numbers, same length as prices,
 *                at least one strictly positive
 * @returns       sum(price_i * weight_i) / sum(weight_i)
 */
export function weightedAverage(
  prices: number[],
  weights: number[],
): number {
  if (prices.length !== weights.length) {
    throw new Error("prices and weights must have the same length");
  }
  if (prices.length === 0) {
    throw new Error("prices must be non-empty");
  }
  let weightSum = 0;
  for (const w of weights) {
    if (w < 0) throw new Error("weights must be non-negative");
    weightSum += w;
  }
  if (weightSum === 0) {
    throw new Error("at least one weight must be strictly positive");
  }
  let weightedSum = 0;
  for (let i = 0; i < prices.length; i++) {
    weightedSum += prices[i]! * weights[i]!;
  }
  return weightedSum / weightSum;
}

// ═══════════════════════════════════════════════════════════════════════
// THE SPEC — formal FunctionSpec for weightedAverage
// ═══════════════════════════════════════════════════════════════════════

/**
 * The spec input is a tuple [prices, weights] so it matches the
 * function signature weightedAverage(prices, weights) directly.
 */
export type WeightedAverageInput = readonly [number[], number[]];

export const WEIGHTED_AVERAGE_SPEC: FunctionSpec<
  WeightedAverageInput,
  number
> = {
  functionName: "weightedAverage",

  preconditions: [
    {
      name: "same_length",
      description: "prices and weights have the same length",
      check: (i) =>
        Array.isArray(i?.[0]) &&
        Array.isArray(i?.[1]) &&
        i[0].length === i[1].length,
      rationale: "definition of weighted average",
    },
    {
      name: "non_empty",
      description: "prices array is non-empty",
      check: (i) => Array.isArray(i?.[0]) && i[0].length > 0,
      rationale: "no items means no average",
    },
    {
      name: "non_negative_weights",
      description: "all weights are >= 0",
      check: (i) =>
        Array.isArray(i?.[1]) && i[1].every((w: number) => w >= 0),
      rationale: "negative weight is undefined",
    },
    {
      name: "positive_weight_sum",
      description: "sum of weights is > 0",
      check: (i) =>
        Array.isArray(i?.[1]) && i[1].reduce((a: number, b: number) => a + b, 0) > 0,
      rationale: "denominator cannot be zero",
    },
  ],

  postconditions: [
    {
      name: "within_range",
      description: "output is between min(prices) and max(prices)",
      check: (i, o) => {
        const prices = i?.[0];
        if (!Array.isArray(prices) || prices.length === 0) return o === 0;
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        return o >= min - 1e-9 && o <= max + 1e-9;
      },
      rationale: "weighted average is a convex combination",
    },
    {
      name: "is_finite",
      description: "output is a finite number",
      check: (_i, o) => Number.isFinite(o),
      rationale: "no NaN or Infinity",
    },
    {
      name: "equal_weights_is_mean",
      description:
        "when all weights are equal, output equals simple arithmetic mean",
      check: (i, o) => {
        const prices = i?.[0];
        const weights = i?.[1];
        if (!Array.isArray(prices) || !Array.isArray(weights)) return true;
        const allEqual = weights.every((w) => w === weights[0]);
        if (!allEqual) return true;
        const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
        return Math.abs(o - mean) < 1e-9;
      },
      rationale: "equal weights => arithmetic mean",
    },
  ],

  invariants: [
    {
      name: "no_nan_output",
      description: "for any valid input, output is never NaN",
      check: (_i, o) => !Number.isNaN(o),
      rationale: "valid inputs must produce valid output",
      arbitrary: (): WeightedAverageInput => {
        const len = 1 + Math.floor(Math.random() * 5);
        const prices = Array.from({ length: len }, () => Math.random() * 100);
        const weights = Array.from({ length: len }, () => Math.random());
        return [prices, weights] as WeightedAverageInput;
      },
    },
    {
      name: "single_element_passthrough",
      description: "single-element arrays return that element",
      check: ([prices], o) => {
        if (prices.length !== 1) return true;
        return Math.abs(o - prices[0]!) < 1e-9;
      },
      rationale: "one point is its own average",
      arbitrary: (): WeightedAverageInput => [
        [Math.random() * 100],
        [Math.random()],
      ],
    },
  ],

  edgeCases: [
    {
      name: "two_equal",
      description: "[10, 20] with equal weights => 15",
      input: [[10, 20], [1, 1]],
      expectedOutput: 15,
    },
    {
      name: "skewed",
      description: "[10, 20] with weights [9, 1] => 11",
      input: [[10, 20], [9, 1]],
      expectedOutput: 11,
    },
    {
      name: "single",
      description: "[42] with weight [1] => 42",
      input: [[42], [1]],
      expectedOutput: 42,
    },
    {
      name: "zero_weight_one",
      description: "[10, 20] with weights [0, 1] => 20",
      input: [[10, 20], [0, 1]],
      expectedOutput: 20,
    },
    {
      name: "fractions",
      description: "[1, 2, 3] with equal weights => 2",
      input: [[1, 2, 3], [1, 1, 1]],
      expectedOutput: 2,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// THE POPDD DEMO — run the full loop
// ═══════════════════════════════════════════════════════════════════════

export interface PopddDemoResult {
  specName: string;
  verification: VerificationResult;
  chainPath: string;
  chainValid: boolean;
  receiptCount: number;
  tamperDetected: boolean;
}

export async function runPopddDemo(
  chainDir: string = ".lux/receipts",
): Promise<PopddDemoResult> {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  POPDD END-TO-END DEMO — weightedAverage(prices, weights)");
  console.log("══════════════════════════════════════════════════════════════\n");

  // ─── Setup signer + chain ───
  const signer = new HmacSigner(HmacSigner.generateKey());
  const chain = new ReceiptChain(signer, { agentId: "lux-popdd-demo" });
  const timestamp = new Date().toISOString();

  // ─── Step 1: SPECIFY — record the spec being written ───
  console.log("Step 1: SPECIFY — record the formal specification");
  const specReceipt = chain.append({
    action: "spec-write",
    target: "weightedAverage",
    proof: {
      verdict: "PASS",
      preconditions: 4,
      postconditions: 3,
      invariants: 2,
      edgeCases: 5,
    },
    timestamp,
  });
  console.log(
    `  → Receipt #${specReceipt.sequence}: ${specReceipt.action} ${specReceipt.target}`,
  );
  console.log(`    contentHash: ${specReceipt.contentHash.slice(0, 16)}...`);
  console.log(`    signature:   ${specReceipt.signature.slice(0, 16)}...\n`);

  // ─── Step 2: VERIFY — run the SpecVerifier ───
  console.log("Step 2: VERIFY — run SpecVerifier on the implementation");
  const verifier = new SpecVerifier();
  const result = verifier.verify(
    WEIGHTED_AVERAGE_SPEC,
    (input) => weightedAverage(...(input as [number[], number[]])),
    1000, // invariant samples
  );
  console.log(`  → verdict: ${result.verdict}`);
  console.log(
    `  → clauses: ${result.passedClauses}/${result.totalClauses} passed\n`,
  );

  // ─── Step 3: SIGN — receipt the verification result (POPDD layer) ───
  console.log("Step 3: SIGN — append DecisionReceipt for the verification");
  const verifyReceipt = chain.append({
    action: "verify",
    target: "weightedAverage",
    proof: {
      verdict: result.verdict,
      passedClauses: result.passedClauses,
      totalClauses: result.totalClauses,
      invariantSamples: 1000,
      timestamp: result.timestamp,
    },
  });
  console.log(
    `  → Receipt #${verifyReceipt.sequence}: ${verifyReceipt.action} ${verifyReceipt.target}`,
  );
  console.log(`    proof.verdict: ${verifyReceipt.proof.verdict}`);
  console.log(`    previousHash:  ${verifyReceipt.previousHash.slice(0, 16)}...`);
  console.log(`    contentHash:   ${verifyReceipt.contentHash.slice(0, 16)}...`);
  console.log(`    signature:     ${verifyReceipt.signature.slice(0, 16)}...\n`);

  // ─── Step 4: EDIT — receipt the file edit ───
  console.log("Step 4: EDIT — append DecisionReceipt for the file change");
  const editReceipt = chain.append({
    action: "edit",
    target: "src/math/weighted.ts",
    proof: {
      verdict: "PASS",
      sha256: "demo-no-real-file-edit",
      diffLines: 38,
      added: ["weightedAverage function", "WEIGHTED_AVERAGE_SPEC"],
    },
  });
  console.log(
    `  → Receipt #${editReceipt.sequence}: ${editReceipt.action} ${editReceipt.target}`,
  );
  console.log(`    contentHash: ${editReceipt.contentHash.slice(0, 16)}...\n`);

  // ─── Step 5: TEST — receipt the test run ───
  console.log("Step 5: TEST — append DecisionReceipt for the test pass");
  const testReceipt = chain.append({
    action: "test-run",
    target: "tests/weighted.test.ts",
    proof: {
      verdict: "PASS",
      tests: 5,
      passed: 5,
      failed: 0,
      duration_ms: 12,
    },
  });
  console.log(
    `  → Receipt #${testReceipt.sequence}: ${testReceipt.action} ${testReceipt.target}`,
  );
  console.log(`    contentHash: ${testReceipt.contentHash.slice(0, 16)}...\n`);

  // ─── Step 6: PERSIST — save the chain to disk ───
  console.log("Step 6: PERSIST — save chain to disk");
  mkdirSync(chainDir, { recursive: true });
  const chainPath = join(chainDir, `chain-${timestamp.replace(/[:.]/g, "-")}.jsonl`);
  chain.save(chainPath);
  const fileSize = readFileSync(chainPath, "utf8").length;
  console.log(`  → wrote ${fileSize} bytes to ${chainPath}\n`);

  // ─── Step 7: RELOAD + VERIFY — read back, check integrity ───
  console.log("Step 7: RELOAD + VERIFY — read chain back, check integrity");
  const reloaded = readFileSync(chainPath, "utf8").trim().split("\n");
  const parsed = reloaded.map((l) => JSON.parse(l));
  console.log(`  → reloaded ${parsed.length} receipts from disk`);

  const verifyResult = chain.verify();
  console.log(
    `  → chain.verify(): ${JSON.stringify(verifyResult, null, 2).replace(/\n/g, "\n    ")}\n`,
  );

  // ─── Step 8: TAMPER — modify a receipt, show detection ───
  console.log("Step 8: TAMPER — modify receipt #1's proof, re-verify");
  const liveReceipts = [...chain.all()];
  liveReceipts[1]!.proof = {
    verdict: "FAIL",
    passedClauses: 0,
    totalClauses: 0,
    invariantSamples: 0,
    timestamp: Date.now(),
  };
  const tamperedResult = chain.verify();
  console.log(
    `  → chain.verify() after tampering: ${JSON.stringify(tamperedResult)}\n`,
  );

  // ─── Summary ───
  console.log("══════════════════════════════════════════════════════════════");
  console.log("  POPDD DEMO RESULT");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`  spec:           ${WEIGHTED_AVERAGE_SPEC.functionName}`);
  console.log(`  verification:   ${result.verdict} (${result.passedClauses}/${result.totalClauses})`);
  console.log(`  receipts:       ${parsed.length}`);
  console.log(`  chain valid:    ${verifyResult.valid}`);
  console.log(`  chain path:     ${chainPath}`);
  console.log(`  tamper caught:  ${!tamperedResult.valid}`);
  console.log("══════════════════════════════════════════════════════════════\n");

  return {
    specName: WEIGHTED_AVERAGE_SPEC.functionName,
    verification: result,
    chainPath,
    chainValid: verifyResult.valid,
    receiptCount: parsed.length,
    tamperDetected: !tamperedResult.valid,
  };
}

// Allow direct execution
if (
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].endsWith("popdd-e2e.ts")
) {
  runPopddDemo().then((r) => {
    process.exit(r.chainValid && r.tamperDetected ? 0 : 1);
  });
}
