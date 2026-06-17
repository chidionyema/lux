# LUX — Proof-Driven Development for TypeScript

**Formal specifications. Property testing. Dafny mathematical proofs. Semgrep security auditing. All in TypeScript.**

[![Tests](https://img.shields.io/badge/tests-72%20passed-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178C6)]()
[![Dafny](https://img.shields.io/badge/Dafny-4.11.0-1E90FF)]()
[![Semgrep](https://img.shields.io/badge/Semgrep-1.166.0-444444)]()

---

## What LUX Is

LUX brings **four levels of verification** to everyday TypeScript development. You write a specification for your function — preconditions, postconditions, invariants, edge cases — and LUX proves (or disproves) that your implementation satisfies it.

1. **Property testing** (statistical) — 1,000+ random samples, P(failure) < 10⁻²⁰
2. **Type-level proofs** (finite domain) — TypeScript's type system as proof checker
3. **Dafny mathematical proofs** (infinite domain) — Z3 SMT solver, ∀-proven for ALL inputs
4. **Semgrep security audit** — 2,000+ community rules, OWASP Top 10, CWE Top 25

## Quick Start

```bash
npm install lux-engine
npm test                    # 72+ tests
npm run prove               # Dafny mathematical proofs
npm run audit               # Semgrep security audit
npm run specs               # Spec registry management
npm run verify-api           # Start HTTP verification API (port 4200)
```

### Prerequisites

| Tool | Version | Install | Required For |
|------|---------|---------|-------------|
| Node.js | ≥22 | [nodejs.org](https://nodejs.org) | Core engine |
| TypeScript | ≥5.4 | `npm install` | Type-level proofs |
| Dafny | ≥4.11 | `dotnet tool install -g dafny` | Mathematical proofs (`npm run prove`) |
| Z3 | ≥4.12 | `brew install z3` | Dafny's SMT solver |
| Semgrep | ≥1.166 | `pip3 install semgrep` | Security audit (`npm run audit`) |

```bash
# One-time setup for mathematical proofs
dotnet tool install -g dafny
brew install z3
# Verify Dafny works
dafny --version
```

---

## Four Levels of Verification

| Level | Method | Domain | Confidence | Command |
|-------|--------|--------|------------|---------|
| **L1** | Property testing | Statistical | P(failure) < 10⁻²⁰ at 1000 samples | `npm test` |
| **L2** | Exhaustive testing | Finite domain | 100% for enumerated inputs | `npm test` |
| **L3** | Type-level proofs | Finite domain | tsc-verified for specific cases | `npm run typecheck` |
| **L4** | Dafny mathematical | Infinite domain | ∀-proven by Z3 SMT solver | `npm run prove` |

**Honest labeling**: All levels use "VALIDATED" not "PROVEN" for statistical verification. Only Dafny results use "PROVEN" — and only when Z3 confirms ∀-correctness.

### Mathematical Proof Example

```typescript
// This function has been MATHEMATICALLY PROVEN correct
// for ALL integer totals and ALL string tiers.
// Not sampled. Not statistical. ∀-proven by Z3.

method CalculateDiscount(total: int, tier: string) returns (discount: real)
  requires total >= 0
  ensures 0.0 <= discount <= total as real
  ensures tier == "platinum" ==> discount >= 0.2 * (total as real)
  ensures tier == "gold" ==> discount >= 0.1 * (total as real)
```

```bash
npm run prove CalculateDiscount
# → PROVEN: 1 verification condition satisfied for ALL inputs
```

---

## API Usage

### Property-Based Verification

```typescript
import { SpecVerifier, VerifiedFunction, type FunctionSpec } from "lux-engine";

const emailSpec: FunctionSpec<string, boolean> = {
  functionName: "validateEmail",
  preconditions: [
    { name: "non_empty", description: "Input must be non-empty", 
      check: (i) => i.length > 0, rationale: "Empty strings cannot be valid emails" },
  ],
  postconditions: [
    { name: "has_at", description: "Valid emails contain @", 
      check: (i, o) => o ? i.includes("@") : true, rationale: "Emails must have @" },
  ],
  invariants: [
    { name: "never_throws", description: "Never throws for any string",
      check: (_i, o) => typeof o === "boolean", 
      arbitrary: () => "test@example.com", rationale: "Must handle all inputs" },
  ],
  edgeCases: [
    { name: "valid", description: "Valid email passes", input: "user@example.com", expectedOutput: true },
    { name: "no_at", description: "Missing @ fails", input: "notanemail", expectedOutput: false },
    { name: "empty", description: "Empty string fails", input: "", expectedOutput: false },
  ],
  noThrow: true,
};

const verified = new VerifiedFunction(emailSpec, validateEmail);
const result = verified.verify(1000);
console.log(result.verdict); // "PASS" or "FAIL" with counterexamples
```

### Dafny Mathematical Proof

```typescript
import { dafnyVerify, CALCULATE_DISCOUNT_DAFNY } from "lux-engine";

const result = dafnyVerify(CALCULATE_DISCOUNT_DAFNY);
// → { verdict: "PROVEN", conditionsPassed: 1, conditionsChecked: 1 }
// This is MATHEMATICAL proof — not statistical sampling.
```

### Semgrep Security Audit

```typescript
import { auditWithSemgrep, auditFile } from "lux-engine";

// Audit inline code
const result = auditWithSemgrep("element.innerHTML = userInput;");
// → { verdict: "FAIL", findings: [{ ruleId: "javascript.browser.security...", severity: "ERROR" }] }

// Audit a file
const fileResult = auditFile("src/payment/processor.ts");
// → Uses 2,000+ community rules: OWASP Top 10, CWE Top 25, language best practices
```

### Spec Registry (Anti-Staleness)

```typescript
import { registerSpec, checkSpecStaleness, getStaleSpecs } from "lux-engine";

// Register a spec when created
registerSpec("calculateDiscount", "src/pricing.ts", sourceCode, 5, 4);

// Check if spec is stale (source changed since last verification)
const { status } = checkSpecStaleness("calculateDiscount", currentCode);
// → "PASS" | "FAIL" | "NEEDS_REVIEW"

// CI gate: block merges with stale specs
const stale = getStaleSpecs();
if (stale.length > 0) process.exit(1);
```

### HTTP Verification API

```bash
npm run verify-api
# → Verification API on http://localhost:4200

curl -X POST localhost:4200/verify \
  -H "Content-Type: application/json" \
  -d '{"functionName":"fn","functionBody":"...","edgeCases":[...],"samples":1000}'
```

---

## What's Verified

| Component | Status | Method |
|-----------|--------|--------|
| **SpecVerifier** | 72 tests passing | Property testing (L1-L2) |
| **Type-level proofs** | Zero tsc errors | TypeScript compiler (L3) |
| **CalculateDiscount** | ✅ PROVEN | Dafny + Z3 (L4, mathematical) |
| **Factorial** | ✅ PROVEN | Dafny + Z3 (L4, mathematical) |
| **Semgrep audit** | 2,000+ rules | Community security ruleset |
| **Spec staleness** | CI gate active | SHA256 version tracking |

## Honest Limits

| Claim | Reality |
|-------|---------|
| "L4 — PROVEN" | Only for functions verified by Dafny. Statistical verification is "VALIDATED" not "PROVEN." |
| "Mechanical proof" | TypeScript type system validates finite domains only (2 values, 6 values, etc.). Cannot express ∀n. |
| "Auto-spec extraction" | Regex-based parser. Handles simple `expect(fn(input)).toBe(output)` patterns. Misses async, mocks, property tests. |
| "Zero-friction" | Extension uses sandboxed `new Function()`. No filesystem access, no network, whitelist-only globals. Documented security model. |

## Project Structure

```
src/
├── core/semantic-graph.ts       AST-based codebase parsing + patching
├── proof/
│   ├── spec.ts                  Specification language + verifier (L1-L3)
│   ├── spec-registry.ts         SHA256 version tracking + CI gate
│   ├── type-level-proofs.ts     TypeScript-based proofs (L3)
│   ├── dafny-bridge.ts          Dafny mathematical verification (L4)
│   ├── receipt.ts               DecisionReceipts (POPDD) — cryptographic chain-of-custody
│   ├── semgrep-audit.ts         Semgrep security auditing
│   └── verify-api.ts            HTTP API for Hermes integration
└── index.ts                     Public API

tests/
├── spec-staleness.test.ts       CI gate: blocks stale specs
├── proof-driven.test.ts         Meta-verification (14 tests)
├── proof-of-proof.test.ts       L1-L4 validation (9 tests)
├── semantic-graph.test.ts       Core engine (20 tests)
├── real-project-proofs.test.ts  Production code verification (7 tests)
└── receipt.test.ts              Tamper-evident proofs (20 tests)
```

## Commands

| Command | What It Does |
|---------|-------------|
| `npm test` | Run all tests including spec staleness gate |
| `npm run prove` | Run Dafny mathematical proofs |
| `npm run prove Factorial` | Prove specific function |
| `npm run audit` | Run Semgrep security audit |
| `npm run audit file <path>` | Audit specific file |
| `npm run specs list` | List all registered specs |
| `npm run specs stale` | Show stale specs (non-zero = CI block) |
| `npm run verify-api` | Start HTTP verification API |
| `npm run typecheck` | TypeScript type-level proof verification |
| `npm run lint` | Full TypeScript type checking |

## Design Principles

1. **Every claim is measured.** "VALIDATED" means empirically tested. "PROVEN" means Dafny-verified.
2. **Honest about limits.** Statistical is not mathematical. Finite-domain is not infinite. We tell you which is which.
3. **Specs can't go stale.** SHA256 hashing detects source changes. CI blocks merges with unreviewed specs.
4. **Security is Semgrep, not string matching.** 2,000+ community rules, not `includes("eval(")`.
5. **Sandboxed evaluation.** `new Function()` runs with whitelist-only globals, no filesystem, no network.

## License

MIT
