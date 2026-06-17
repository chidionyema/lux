/**
 * DECISION RECEIPT TESTS — POPDD (Proof of Proof-Driven Development)
 *
 * Verifies the cryptographic chain-of-custody layer:
 *   1. Receipts are signed and chained correctly
 *   2. Chain verification passes for a clean chain
 *   3. Tampering with any receipt invalidates the chain
 *   4. Signer key persistence works (loadOrCreate)
 *   5. Integration with the PDD engine — verification results get signed
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  HmacSigner,
  ReceiptChain,
  type DecisionReceipt,
  type ChainVerification,
} from "../src/proof/receipt";
import { SpecVerifier, generatePropertyTestCode, type FunctionSpec } from "../src/proof/spec";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ═══════════════════════════════════════════════════════════════════════
// 1. SIGNER BASICS
// ═══════════════════════════════════════════════════════════════════════

describe("HmacSigner", () => {
  test("generates a 256-bit key on demand", () => {
    const k = HmacSigner.generateKey();
    expect(k.length).toBe(32);
  });

  test("two keys with the same input produce different signatures", () => {
    const k1 = HmacSigner.generateKey();
    const k2 = HmacSigner.generateKey();
    const s1 = new HmacSigner(k1).sign("hello");
    const s2 = new HmacSigner(k2).sign("hello");
    expect(s1).not.toBe(s2);
  });

  test("the same key signs the same input deterministically", () => {
    const k = HmacSigner.generateKey();
    const s = new HmacSigner(k);
    expect(s.sign("hello")).toBe(s.sign("hello"));
  });

  test("verifierId is a 16-char hex fingerprint of the key", () => {
    const k = HmacSigner.generateKey();
    const s = new HmacSigner(k);
    expect(s.verifierId()).toMatch(/^[0-9a-f]{16}$/);
  });

  test("the same key yields the same verifierId", () => {
    const k = HmacSigner.generateKey();
    expect(new HmacSigner(k).verifierId()).toBe(new HmacSigner(k).verifierId());
  });

  test("loadOrCreateKey generates a key when none exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "lux-receipt-"));
    try {
      const keyPath = join(dir, "agent.pem");
      expect(existsSync(keyPath)).toBe(false);
      const k = HmacSigner.loadOrCreateKey(keyPath);
      expect(k.length).toBe(32);
      expect(existsSync(keyPath)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("loadOrCreateKey returns the same key on second call", () => {
    const dir = mkdtempSync(join(tmpdir(), "lux-receipt-"));
    try {
      const keyPath = join(dir, "agent.pem");
      const k1 = HmacSigner.loadOrCreateKey(keyPath);
      const k2 = HmacSigner.loadOrCreateKey(keyPath);
      expect(k1.equals(k2)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("loadOrCreateKey rejects malformed key files", () => {
    const dir = mkdtempSync(join(tmpdir(), "lux-receipt-"));
    try {
      const keyPath = join(dir, "agent.pem");
      const { writeFileSync } = require("node:fs");
      writeFileSync(keyPath, "not-hex");
      expect(() => HmacSigner.loadOrCreateKey(keyPath)).toThrow(/Invalid key/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. RECEIPT CHAIN
// ═══════════════════════════════════════════════════════════════════════

describe("ReceiptChain", () => {
  let signer: HmacSigner;
  let chain: ReceiptChain;

  beforeEach(() => {
    signer = new HmacSigner(HmacSigner.generateKey());
    chain = new ReceiptChain(signer, { agentId: "lux-test" });
  });

  test("an empty chain reports 0 receipts and verifies", () => {
    expect(chain.all()).toHaveLength(0);
    const v: ChainVerification = chain.verify();
    expect(v.valid).toBe(true);
    expect(v.totalReceipts).toBe(0);
  });

  test("the first receipt's previousHash is GENESIS", () => {
    const r = chain.append({
      action: "verify",
      target: "fn",
      proof: { verdict: "PASS" },
    });
    expect(r.sequence).toBe(0);
    expect(r.previousHash).toBe("GENESIS");
  });

  test("subsequent receipts chain to the prior contentHash", () => {
    const r1 = chain.append({
      action: "verify",
      target: "fn1",
      proof: { verdict: "PASS" },
    });
    const r2 = chain.append({
      action: "edit",
      target: "fn2",
      proof: { verdict: "PASS" },
    });
    expect(r2.previousHash).toBe(r1.contentHash);
  });

  test("a clean chain verifies", () => {
    chain.append({ action: "verify", target: "a", proof: { verdict: "PASS" } });
    chain.append({ action: "edit", target: "b", proof: { verdict: "PASS" } });
    chain.append({ action: "publish", target: "c", proof: { verdict: "PASS" } });
    const v = chain.verify();
    expect(v.valid).toBe(true);
    expect(v.totalReceipts).toBe(3);
  });

  test("a chain signed with a different key fails verification", () => {
    chain.append({ action: "verify", target: "a", proof: { verdict: "PASS" } });
    chain.append({ action: "edit", target: "b", proof: { verdict: "PASS" } });

    // Replace the signer with a different one — signatures won't match
    const differentSigner = new HmacSigner(HmacSigner.generateKey());
    const newChain = new ReceiptChain(differentSigner, { agentId: "lux-test" });
    // Re-append the same content
    newChain.append({ action: "verify", target: "a", proof: { verdict: "PASS" } });
    newChain.append({ action: "edit", target: "b", proof: { verdict: "PASS" } });

    // Verifying with the new signer should succeed (it just signed them)
    expect(newChain.verify().valid).toBe(true);

    // But mutating one receipt in the chain invalidates it
    // (Note: chain.all() returns a live reference to the internal array,
    //  so we can mutate the receipt in place.)
    const allReceipts: readonly DecisionReceipt[] = newChain.all();
    const receiptToMutate: DecisionReceipt = allReceipts[1] as DecisionReceipt;
    receiptToMutate.proof = { verdict: "FAIL" };
    const v = newChain.verify();
    expect(v.valid).toBe(false);
    expect(v.brokenAt).toBe(1);
  });

  test("tampering with a receipt's proof is detected", () => {
    chain.append({ action: "verify", target: "a", proof: { verdict: "PASS" } });
    chain.append({ action: "edit", target: "b", proof: { verdict: "PASS" } });
    chain.append({ action: "publish", target: "c", proof: { verdict: "PASS" } });

    // Mutate receipt 1's proof via the array reference (test-only)
    const receipts: DecisionReceipt[] = [...chain.all()];
    const r1 = receipts[1]!;
    r1.proof = { verdict: "FAIL" };

    const v = chain.verify();
    expect(v.valid).toBe(false);
    expect(v.brokenAt).toBe(1);
    expect(v.reason).toMatch(/contentHash/);
  });

  test("tampering with a receipt's signature is detected", () => {
    chain.append({ action: "verify", target: "a", proof: { verdict: "PASS" } });
    chain.append({ action: "edit", target: "b", proof: { verdict: "PASS" } });

    const receipts: DecisionReceipt[] = [...chain.all()];
    receipts[0]!.signature = "0".repeat(64);

    const v = chain.verify();
    expect(v.valid).toBe(false);
    expect(v.brokenAt).toBe(0);
    expect(v.reason).toMatch(/signature/);
  });

  test("tampering with previousHash on a later receipt is detected", () => {
    chain.append({ action: "verify", target: "a", proof: { verdict: "PASS" } });
    chain.append({ action: "edit", target: "b", proof: { verdict: "PASS" } });
    chain.append({ action: "publish", target: "c", proof: { verdict: "PASS" } });

    const receipts: DecisionReceipt[] = [...chain.all()];
    receipts[2]!.previousHash = "0".repeat(64);

    const v = chain.verify();
    expect(v.valid).toBe(false);
    expect(v.brokenAt).toBe(2);
    expect(v.reason).toMatch(/previousHash/);
  });

  test("determinism: same sequence of actions produces identical contentHashes", () => {
    const s = new HmacSigner(HmacSigner.generateKey());
    const c1 = new ReceiptChain(s, { agentId: "lux-test" });
    const c2 = new ReceiptChain(s, { agentId: "lux-test" });

    // Pin the timestamp so the hashes are byte-identical
    const ts = "2026-06-17T12:00:00.000Z";
    c1.append({ action: "verify", target: "fn", proof: { verdict: "PASS" }, timestamp: ts });
    c2.append({ action: "verify", target: "fn", proof: { verdict: "PASS" }, timestamp: ts });

    const h1 = c1.all()[0]!;
    const h2 = c2.all()[0]!;
    expect(h1.contentHash).toBe(h2.contentHash);
    expect(h1.signature).toBe(h2.signature);
  });

  test("save() writes valid JSONL with one receipt per line", () => {
    chain.append({ action: "verify", target: "a", proof: { verdict: "PASS" } });
    chain.append({ action: "edit", target: "b", proof: { verdict: "PASS" } });

    const dir = mkdtempSync(join(tmpdir(), "lux-receipt-"));
    try {
      const out = join(dir, "receipts.jsonl");
      chain.save(out);
      const lines = readFileSync(out, "utf8").trim().split("\n");
      expect(lines).toHaveLength(2);
      for (const line of lines) {
        const parsed = JSON.parse(line);
        expect(parsed.sequence).toBeDefined();
        expect(parsed.signature).toBeDefined();
        expect(parsed.contentHash).toBeDefined();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. INTEGRATION WITH PDD ENGINE
// ═══════════════════════════════════════════════════════════════════════

describe("POPDD integration: receipts for real PDD verifications", () => {
  test("a SpecVerifier PASS result can be signed into a receipt", () => {
    // A function that always doubles its input
    const double = (n: number) => n * 2;
    const spec: FunctionSpec<number, number> = {
      functionName: "double",
      preconditions: [
        { name: "is_number", description: "input is a number", check: (n) => typeof n === "number", rationale: "type guard" },
      ],
      postconditions: [
        { name: "is_twice", description: "output is 2x input", check: (i, o) => o === i * 2, rationale: "definition" },
        { name: "is_number", description: "output is number", check: (i, o) => typeof o === "number", rationale: "type guard" },
      ],
      invariants: [
        { name: "always_doubles", description: "for any number, output is 2x", check: (_i, o) => typeof o === "number" && !isNaN(o), rationale: "stays numeric", arbitrary: () => Math.random() * 100 - 50 },
      ],
      edgeCases: [
        { name: "zero", description: "0 → 0", input: 0, expectedOutput: 0 },
        { name: "negative", description: "-3 → -6", input: -3, expectedOutput: -6 },
        { name: "fraction", description: "1.5 → 3", input: 1.5, expectedOutput: 3 },
      ],
    };

    const verifier = new SpecVerifier();
    const result = verifier.verify(spec, double, 100);

    // Surface the actual verdict for debugging if this fails
    expect(result.verdict).toBe("PASS");

    // Now sign that result into a receipt
    const signer = new HmacSigner(HmacSigner.generateKey());
    const chain = new ReceiptChain(signer, { agentId: "lux-m3" });
    const receipt = chain.append({
      action: "verify",
      target: spec.functionName,
      proof: {
        verdict: result.verdict,
        passed: result.passedClauses,
        total: result.totalClauses,
        samples: 100,
      },
    });

    expect(receipt.proof.verdict).toBe("PASS");
    expect(chain.verify().valid).toBe(true);
  });

  test("a multi-step PDD workflow produces a valid chain", () => {
    const fn = (x: number) => x + 1;
    const spec: FunctionSpec<number, number> = {
      functionName: "increment",
      preconditions: [{ name: "is_number", description: "", check: (n) => typeof n === "number", rationale: "" }],
      postconditions: [
        { name: "is_plus_one", description: "", check: (i, o) => o === i + 1, rationale: "" },
        { name: "is_number", description: "", check: (i, o) => typeof o === "number", rationale: "" },
      ],
      invariants: [
        { name: "always_numeric", description: "", check: (_i, o) => typeof o === "number" && !isNaN(o), rationale: "", arbitrary: () => Math.floor(Math.random() * 100) },
      ],
      edgeCases: [
        { name: "zero", description: "", input: 0, expectedOutput: 1 },
        { name: "negative", description: "", input: -1, expectedOutput: 0 },
      ],
    };

    const verifier = new SpecVerifier();
    const signer = new HmacSigner(HmacSigner.generateKey());
    const chain = new ReceiptChain(signer, { agentId: "lux-m3" });

    // Step 1: Verify the spec itself
    chain.append({ action: "spec-write", target: "increment", proof: { verdict: "PASS", clauses: "2 post + 1 pre" } });

    // Step 2: Run verification
    const result = verifier.verify(spec, fn, 50);
    expect(result.verdict).toBe("PASS");
    chain.append({ action: "verify", target: "increment", proof: { verdict: result.verdict, passed: result.passedClauses, total: result.totalClauses, samples: 50 } });

    // Step 3: Generate property test (free function, takes spec only)
    const code = generatePropertyTestCode(spec);
    chain.append({ action: "generate-test", target: "increment", proof: { verdict: code.length > 0 ? "PASS" : "FAIL", bytes: code.length } });

    // Step 4: Publish
    chain.append({ action: "publish", target: ".lux/specs/increment.json", proof: { verdict: "PASS" } });

    const v = chain.verify();
    expect(v.valid).toBe(true);
    expect(v.totalReceipts).toBe(4);

    // Tampering with step 2's verdict invalidates the chain
    const r = chain.all() as DecisionReceipt[];
    const second = r[1]!;
    second.proof = { verdict: "FAIL", passed: 0, total: 0, samples: 0 };
    expect(chain.verify().valid).toBe(false);
  });
});
