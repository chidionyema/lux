/**
 * End-to-end POPDD test
 *
 * Runs the weightedAverage feature through the full PDD → POPDD loop:
 *   1. Define a real spec
 *   2. Run the verifier
 *   3. Sign 4 DecisionReceipts (spec-write, verify, edit, test-run)
 *   4. Save the chain
 *   5. Verify the chain
 *   6. Tamper with a receipt, confirm detection
 *
 * If this passes, the LUX POPDD layer is working end-to-end.
 */

import { describe, test, expect } from "vitest";
import {
  runPopddDemo,
  weightedAverage,
  WEIGHTED_AVERAGE_SPEC,
} from "../demo/popdd-e2e";
import { SpecVerifier } from "../src/proof/spec";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

describe("POPDD end-to-end (weightedAverage feature)", () => {
  const chainDir = ".lux/test-receipts";

  test("runs the full POPDD loop and produces a valid chain", async () => {
    // Clean up from previous runs
    if (existsSync(chainDir)) {
      rmSync(chainDir, { recursive: true, force: true });
    }

    const result = await runPopddDemo(chainDir);

    // The verification must pass
    expect(result.verification.verdict).toBe("PASS");
    expect(result.verification.passedClauses).toBe(
      result.verification.totalClauses,
    );

    // The chain must exist on disk
    expect(existsSync(result.chainPath)).toBe(true);

    // The chain must contain 4 receipts
    const content = readFileSync(result.chainPath, "utf8").trim();
    const lines = content.split("\n");
    expect(lines).toHaveLength(4);

    // Each receipt must have a signature and chain to the previous
    for (let i = 0; i < lines.length; i++) {
      const r = JSON.parse(lines[i]!);
      expect(r.sequence).toBe(i);
      expect(r.signature).toMatch(/^[0-9a-f]{64}$/);
      expect(r.contentHash).toMatch(/^[0-9a-f]{64}$/);
      if (i === 0) {
        expect(r.previousHash).toBe("GENESIS");
      } else {
        const prev = JSON.parse(lines[i - 1]!);
        expect(r.previousHash).toBe(prev.contentHash);
      }
    }

    // Tamper detection must work
    expect(result.tamperDetected).toBe(true);
  }, 30_000);

  test("the implementation is honest: weightedAverage([10,20],[1,1]) === 15", () => {
    expect(weightedAverage([10, 20], [1, 1])).toBe(15);
    expect(weightedAverage([10, 20], [9, 1])).toBe(11);
    expect(weightedAverage([42], [1])).toBe(42);
    expect(weightedAverage([1, 2, 3], [1, 1, 1])).toBe(2);
  });

  test("the spec is internally consistent", () => {
    const v = new SpecVerifier();
    const r = v.verify(
      WEIGHTED_AVERAGE_SPEC,
      (input) => {
        const [prices, weights] = input as [number[], number[]];
        return weightedAverage(prices, weights);
      },
      100,
    );
    // No contradictions — the spec is well-formed
    expect(r.verdict).toBe("PASS");
    expect(r.passedClauses).toBe(r.totalClauses);
  });
});
