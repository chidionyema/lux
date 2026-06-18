---
name: lux-proof-driven-development
description: "PDD: Write formal specifications. Prove correctness. Auto-verify every change. TDD + mathematical guarantees. Use this for ALL code changes."
version: 1.0.0
author: LUX Engine (built on Hermes Agent)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [proof, verification, specification, testing, quality, formal-methods, correctness]
    related_skills: [test-driven-development, systematic-debugging, plan, requesting-code-review]
---

# Proof-Driven Development (PDD)

## Overview

TDD proves your code works for the cases you thought of. PDD proves your code works for ALL cases in the specification.

**Core principle:** A test is a single point. A proof covers the entire space.

**PDD = TDD + formal specification + mechanical verification**

## When to Use

**Always alongside TDD:**
- Every function you write → write a spec
- Every function you modify → verify against existing spec
- Every bug fix → add the bug as an edge case to the spec

**Exceptions (ask the user first):**
- UI rendering code (visual verification needed)
- Throwaway prototypes
- Configuration files

## The Spec Language

A specification describes WHAT a function does, not HOW:

```
SPEC: validateEmail(input: string) → boolean

PRECONDITIONS:
  • input must be a string

POSTCONDITIONS:
  • Output is boolean
  • If input contains "@" and ".", output is true
  • If input lacks "@", output is false
  • Never throws for any string input

INVARIANTS (must hold for ALL inputs):
  • typeof output === "boolean"

EDGE CASES:
  ✅ "user@example.com" → true
  ✅ "notanemail" → false
  ✅ "" → false
  ✅ "@" → false
  ✅ null → false (handled gracefully)
```

## The PDD Cycle

### 1. SPECIFY — Write the Specification FIRST

Before writing any code, specify:
- **Preconditions**: What must be true before the function runs
- **Postconditions**: What must be true after the function runs
- **Invariants**: What must hold for ALL valid inputs
- **Edge Cases**: Specific inputs with expected outputs

**Good spec:**
```
SPEC: calculateDiscount(total, customerTier)

PRECONDITIONS:
  • total ≥ 0
  • customerTier ∈ {"bronze", "silver", "gold", "platinum"}

POSTCONDITIONS:
  • 0 ≤ output ≤ total
  • platinum → output ≥ 0.20 × total
  • gold → output ≥ 0.10 × total
  • output is a number, not NaN

EDGE CASES:
  ✅ (0, "platinum") → 0
  ✅ (100, "gold") → ≥ 10
  ✅ (100, "bronze") → 0
  ✅ (-1, "gold") → THROWS (precondition violation)
```

**Bad spec:**
```
SPEC: calculateDiscount
// "Returns the right discount"
// Vague, untestable, no constraints
```

### 2. VERIFY — Prove the Spec is Consistent

Before implementing, verify the spec makes sense:
- No contradictory postconditions
- Edge cases satisfy all postconditions
- Invariants are satisfiable

If a spec has contradictions, NO implementation can satisfy it. Catch this early.

### 3. IMPLEMENT — TDD with the Spec as Guide

Write tests FROM the specification:
1. Each edge case → one test
2. Each postcondition → property test (many random inputs)
3. Each invariant → fast-check property

```python
# From the calculateDiscount spec:
def test_discount_never_exceeds_total():
    """Postcondition: 0 ≤ output ≤ total"""
    for _ in range(100):
        total = random.uniform(0, 10000)
        tier = random.choice(["bronze", "silver", "gold", "platinum"])
        result = calculate_discount(total, tier)
        assert 0 <= result <= total

def test_platinum_gets_minimum_20_percent():
    """Postcondition: platinum → output ≥ 0.20 × total"""
    result = calculate_discount(100, "platinum")
    assert result >= 20

def test_edge_zero_total():
    """Edge case: (0, "platinum") → 0"""
    assert calculate_discount(0, "platinum") == 0
```

### 4. PROVE — Run the Verifier

Use LUX's verification engine to check ALL postconditions against random samples:

```bash
# Install LUX
pip install lux-engine

# Create verification script
cat > verify_discount.py << 'EOF'
from lux import SpecVerifier, FunctionSpec
from my_module import calculate_discount

spec = FunctionSpec(
    function_name="calculateDiscount",
    preconditions=[
        {"name": "non_negative", "check": lambda x: x[0] >= 0},
        {"name": "valid_tier", "check": lambda x: x[1] in ["bronze","silver","gold","platinum"]},
    ],
    postconditions=[
        {"name": "bounded", "check": lambda i, o: 0 <= o <= i[0]},
        {"name": "platinum_min", "check": lambda i, o: i[1] != "platinum" or o >= 0.2 * i[0]},
    ],
    invariants=[
        {"name": "no_nan", "check": lambda i, o: not (o != o), "arbitrary": lambda: (random.uniform(0,1000), random.choice(["bronze","silver","gold","platinum"]))},
    ],
    edge_cases=[
        {"input": (0, "platinum"), "expected": 0},
        {"input": (100, "bronze"), "expected": 0},
    ],
)

verifier = SpecVerifier()
result = verifier.verify(spec, calculate_discount, samples=10000)
print(f"Verdict: {result.verdict}")
print(f"Clauses: {result.passed}/{result.total} passed")
EOF

python verify_discount.py
```

### 5. REFACTOR — With Proof Confidence

After refactoring, re-run the verifier. If all clauses still pass, your refactor is PROVEN to preserve behavior for the specified domain.

```
Refactored → re-ran verifier → 10000/10000 clauses PASS → SAFE TO MERGE
```

## PDD + TDD: The Complete Cycle

```
SPECIFY  →  Write formal spec (pre/post/invariants/edges)
   ↓
VERIFY   →  Prove spec is consistent (no contradictions)
   ↓
TEST     →  Write tests FROM the spec (RED)
   ↓
IMPLEMENT →  Write code to pass tests (GREEN)
   ↓
PROVE    →  Run verifier on 10000+ random inputs
   ↓
REFACTOR →  Clean up, re-verify, merge
```

**Without PDD**: "Tests pass, ship it" — but did you test `total=-1`? `tier="diamond"`? `total=9999999999`?

**With PDD**: "Spec satisfied, 10000 random inputs verified, all postconditions hold" — you KNOW it's correct for the entire specified domain.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "TDD is enough" | TDD tests specific points. PDD covers the entire input space statistically. |
| "Writing specs takes too long" | Writing specs is faster than debugging production bugs the spec would have caught. |
| "My function is too simple" | Simple functions have simple specs. A 3-line spec for a 5-line function takes 30 seconds. |
| "I'll add the spec after" | Specs after implementation are biased — you specify what you built, not what's needed. |
| "Formal verification is academic" | Property testing is production-tested. fast-check runs billions of tests weekly in CI pipelines. |

## Verification Checklist

Before marking work complete:

- [ ] Spec written BEFORE implementation
- [ ] Spec has at least 3 edge cases
- [ ] Spec has at least 2 postconditions
- [ ] Spec verified consistent (no contradictions)
- [ ] All edge cases have corresponding tests
- [ ] Property tests cover all postconditions
- [ ] Verifier run with ≥1000 samples
- [ ] All clauses PASS
- [ ] Spec saved for future regression detection

Can't check all boxes? Go back to SPECIFY.

## Hermes Agent Integration

### Creating a Spec

Use `terminal` to run the spec tool:

```bash
# Initialize LUX in the project
lux init

# Create a spec for a function
lux spec add calculateDiscount \
  --precondition "total >= 0" \
  --precondition "tier in ['bronze','silver','gold','platinum']" \
  --postcondition "0 <= output <= total" \
  --postcondition "tier == 'platinum' → output >= 0.2 * total" \
  --edge "(0, 'platinum') → 0" \
  --edge "(100, 'bronze') → 0"
```

### Verifying

```bash
# Verify all specs in the project
lux verify

# Verify a specific function
lux verify calculateDiscount --samples 10000

# Generate property tests from specs
lux generate-tests calculateDiscount > tests/test_discount_property.py
```

### With delegate_task

When dispatching subagents, enforce PDD:

```python
delegate_task(
    goal="Implement calculateDiscount with strict PDD",
    context="""
    Follow lux-proof-driven-development skill:
    1. SPECIFY: Write formal spec with pre/post conditions and edge cases
    2. VERIFY: Prove spec is consistent
    3. TEST: Write tests from spec (RED)
    4. IMPLEMENT: Minimal code (GREEN)
    5. PROVE: Run `lux verify calculateDiscount --samples 10000`
    6. REFACTOR: Clean up, re-verify, commit

    Project test command: pytest tests/ -q
    """,
    toolsets=['terminal', 'file']
)
```

### With requesting-code-review

When requesting code review, include the spec verification:

```
/request-review

Changed: calculateDiscount in src/pricing.py

Spec: .lux/specs/calculateDiscount.json
Verification: 10000/10000 clauses PASS
Edge cases: 5/5 passed
Postconditions: 4/4 satisfied

Please review the implementation for correctness against the spec.
```

## Relationship to TDD

**TDD (test-driven-development skill) is REQUIRED before PDD.**
PDD builds on TDD — you still write tests first, you still watch them fail, you still write minimal code. PDD adds:
- Formal specification of WHAT the function should do
- Property testing across the entire input domain
- Mechanical verification that proofs hold
- Persistent specs for regression detection

Use BOTH skills together. Never use PDD without TDD.

## Final Rule

```
Spec exists → tests exist → verifier passes → PROVEN correct for specified domain
Otherwise → not PDD
```

LUX proves. You ship with confidence.
