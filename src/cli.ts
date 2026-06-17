/**
 * lux CLI — Proof-Driven Development enforcement.
 *
 * Commands:
 *   lux spec create <name>    Create a spec stub for a function
 *   lux spec guard [name]     Check spec exists + is fresh (exit 1 if not)
 *   lux spec verify [name]    Run verifier, sign POPDD receipt
 *   lux spec check            Pre-commit: check all modified specs
 *
 * Philosophy: code is not done until its spec is created, verified,
 * and signed into the POPDD chain. This CLI gates that.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

import { SpecVerifier, type FunctionSpec } from "./proof/spec.js";
import { HmacSigner, ReceiptChain } from "./proof/receipt.js";

// ─── Config ──────────────────────────────────────────────────────────────────

const LUX_DIR = ".lux";
const SPECS_DIR = join(LUX_DIR, "specs");
const REGISTRY_FILE = join(LUX_DIR, "spec-registry.json");
const KEYS_DIR = join(LUX_DIR, "keys");
const RECEIPTS_DIR = join(LUX_DIR, "receipts");
const KEY_FILE = join(KEYS_DIR, "agent.pem");

interface SpecEntry {
  functionName: string;
  file: string;
  sourceHash: string;
  lastVerified: string;
  status: "PASS" | "FAIL" | "NEEDS_REVIEW";
  edgeCaseCount: number;
  postconditionCount: number;
}

interface Registry {
  specs: Record<string, SpecEntry>;
  updatedAt: string;
}

function ensureDirs(): void {
  for (const d of [LUX_DIR, SPECS_DIR, KEYS_DIR, RECEIPTS_DIR]) {
    mkdirSync(d, { recursive: true });
  }
}

function getRegistry(): Registry {
  ensureDirs();
  if (existsSync(REGISTRY_FILE)) {
    return JSON.parse(readFileSync(REGISTRY_FILE, "utf-8"));
  }
  const empty: Registry = { specs: {}, updatedAt: new Date().toISOString() };
  writeFileSync(REGISTRY_FILE, JSON.stringify(empty, null, 2));
  return empty;
}

function saveRegistry(r: Registry): void {
  r.updatedAt = new Date().toISOString();
  writeFileSync(REGISTRY_FILE, JSON.stringify(r, null, 2));
}

function sourceHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function getPOPDDChain(): { signer: HmacSigner; chain: ReceiptChain } {
  const signer = new HmacSigner(HmacSigner.loadOrCreateKey(KEY_FILE));
  const chain = new ReceiptChain(signer, { agentId: "lux-cli" });
  // Load today's receipts to continue the chain
  const today = new Date().toISOString().slice(0, 10);
  const todayPath = join(RECEIPTS_DIR, `${today}.jsonl`);
  return { signer, chain };
}

// ─── Spec Template ───────────────────────────────────────────────────────────

const SPEC_TEMPLATE = `/**
 * SPEC: {name}
 *
 * PRECONDITIONS:
 *   • (what must be true before this function runs)
 *
 * POSTCONDITIONS:
 *   • (what must be true after this function runs)
 *
 * INVARIANTS (must hold for ALL valid inputs):
 *   • (properties that always hold)
 *
 * EDGE CASES:
 *   ✅ () → (expected output)
 */

import type { FunctionSpec } from "lux-engine";

export const spec: FunctionSpec = {
  functionName: "{name}",
  preconditions: [],
  postconditions: [],
  invariants: [],
  edgeCases: [],
  noThrow: false,
};
`;

// ─── Commands ─────────────────────────────────────────────────────────────────

function cmdCreate(name: string): void {
  const file = join(SPECS_DIR, `${name}.spec.ts`);
  if (existsSync(file)) {
    console.log(`⚠️  Spec already exists: ${file}`);
    process.exit(1);
  }
  const content = SPEC_TEMPLATE.replace(/\{name\}/g, name);
  writeFileSync(file, content);

  // Register in registry so guard finds it
  const registry = getRegistry();
  registry.specs[name] = {
    functionName: name,
    file: relative(process.cwd(), file),
    sourceHash: sourceHash(content),
    lastVerified: new Date().toISOString(),
    status: "NEEDS_REVIEW",
    edgeCaseCount: 0,
    postconditionCount: 0,
  };
  saveRegistry(registry);

  console.log(`✅ Spec created: ${file}`);
  console.log(`   Edit the spec, then run: lux spec verify ${name}`);
}

function cmdGuard(names: string[]): void {
  const registry = getRegistry();
  const cwd = process.cwd();
  let failed = false;

  // Get modified files from git if no specific names given
  const targets = names.length > 0 ? names : getModifiedFunctions(registry);

  for (const name of targets) {
    const entry = registry.specs[name];
    if (!entry) {
      console.log(`❌ NO SPEC: ${name} — create one with: lux spec create ${name}`);
      failed = true;
      continue;
    }

    // Check source hasn't drifted
    if (entry.file) {
      const absPath = resolve(cwd, entry.file);
      if (existsSync(absPath)) {
        const current = readFileSync(absPath, "utf-8");
        const currentHash = sourceHash(current);
        if (currentHash !== entry.sourceHash) {
          console.log(`⚠️  STALE SPEC: ${name} — source changed. Run: lux spec verify ${name}`);
          failed = true;
          continue;
        }
      }
    }

    if (entry.status === "NEEDS_REVIEW") {
      console.log(`⚠️  NEEDS REVIEW: ${name} — run: lux spec verify ${name}`);
      failed = true;
      continue;
    }

    if (entry.status === "FAIL") {
      console.log(`❌ FAILED: ${name} — spec verification failed. Fix and run: lux spec verify ${name}`);
      failed = true;
      continue;
    }

    console.log(`✅ ${name} — ${entry.status} (${entry.edgeCaseCount} edges, ${entry.postconditionCount} postconditions)`);
  }

  if (failed) {
    console.log("\n❌ Guard failed — fix above issues before committing.");
    process.exit(1);
  }
}

function cmdVerify(names: string[]): void {
  const cwd = process.cwd();
  const registry = getRegistry();
  const verifier = new SpecVerifier();

  if (names.length === 0) {
    // Verify all specs in registry
    for (const name of Object.keys(registry.specs)) {
      const entry = registry.specs[name];
      if (entry.file && existsSync(resolve(cwd, entry.file))) {
        _verifyOne(name, entry, cwd, verifier, registry);
      }
    }
  } else {
    for (const name of names) {
      const entry = registry.specs[name];
      if (!entry) {
        console.log(`❌ No spec found for '${name}'. Create one: lux spec create ${name}`);
        continue;
      }
      if (!entry.file || !existsSync(resolve(cwd, entry.file))) {
        console.log(`❌ Spec file not found for '${name}': ${entry.file}`);
        continue;
      }
      _verifyOne(name, entry, cwd, verifier, registry);
    }
  }

  saveRegistry(registry);
  console.log("\n✅ Verification complete. Registry updated.");
}

function _verifyOne(
  name: string,
  entry: SpecEntry,
  cwd: string,
  verifier: SpecVerifier,
  registry: Registry,
): void {
  const specPath = resolve(cwd, entry.file);
  const sourceCode = readFileSync(specPath, "utf-8");
  const hash = sourceHash(sourceCode);

  console.log(`\n📋 Verifying: ${name}`);
  console.log(`   File: ${entry.file}`);

  // Try to import the spec and implementation
  try {
    // Load the spec dynamically
    const specModule = require(specPath);
    const spec = specModule.spec as FunctionSpec;

    // Try to import the implementation
    const implPath = join(SPECS_DIR, `${name}.impl.ts`);
    let result;
    if (existsSync(implPath)) {
      const implModule = require(implPath);
      const implementation = implModule.default || implModule.impl;
      result = verifier.verify(spec, implementation);
    } else {
      console.log(`   ⚠️  No implementation found at ${name}.impl.ts — skipping runtime verification`);
      result = { verdict: "INCONCLUSIVE", totalClauses: 0, passedClauses: 0 };
    }

    // Sign POPDD receipt
    try {
      const { signer, chain } = getPOPDDChain();
      chain.append({
        action: "verify",
        target: name,
        proof: {
          verdict: result.verdict,
          passed: result.passedClauses,
          total: result.totalClauses,
        },
      });
      chain.save(join(RECEIPTS_DIR, `${new Date().toISOString().slice(0, 10)}.jsonl`));
    } catch (e) {
      console.log(`   ⚠️  POPDD signing skipped: ${e}`);
    }

    // Update registry
    entry.sourceHash = hash;
    entry.lastVerified = new Date().toISOString();
    entry.status = result.verdict === "PASS" ? "PASS" : "FAIL";
    entry.edgeCaseCount = spec.edgeCases?.length || 0;
    entry.postconditionCount = spec.postconditions?.length || 0;
    registry.specs[name] = entry;

    if (result.verdict === "PASS") {
      console.log(`   ✅ PASS — ${result.passedClauses}/${result.totalClauses} clauses`);
    } else {
      console.log(`   ❌ FAIL — ${result.failedClauses} clause(s) failed`);
      if (result.failedClauses) {
        for (const r of [...result.preconditionResults, ...result.postconditionResults, ...result.edgeCaseResults]) {
          if (r.verdict === "FAIL") {
            console.log(`      • ${r.name}: ${r.description}`);
            if (r.counterexample) console.log(`        Counterexample: ${r.counterexample}`);
          }
        }
      }
    }
  } catch (e) {
    console.log(`   ❌ Error verifying spec: ${e}`);
    entry.status = "NEEDS_REVIEW";
    registry.specs[name] = entry;
  }
}

function cmdCheck(): void {
  // Pre-commit check: finds modified functions and checks their specs
  const registry = getRegistry();

  // Get functions modified in git diff
  const modified = getModifiedFunctions(registry);

  if (modified.length === 0) {
    console.log("✅ No modified functions with registered specs.");
    process.exit(0);
  }

  // Run guard on the modified functions
  cmdGuard(modified);
}

function getModifiedFunctions(registry: Registry): string[] {
  try {
    const diff = execSync(
      "git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || git diff --name-only 2>/dev/null || echo ''",
      { encoding: "utf-8" },
    ).trim();

    if (!diff) return Object.keys(registry.specs); // fallback: check all

    const modifiedFiles = new Set(diff.split("\n").map(f => f.trim()).filter(Boolean));
    const modified: string[] = [];

    for (const [name, entry] of Object.entries(registry.specs)) {
      if (entry.file && modifiedFiles.has(entry.file)) {
        modified.push(name);
      }
    }

    return modified;
  } catch {
    return Object.keys(registry.specs); // fallback: check all
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

function main(): void {
  const cmd = process.argv[2];
  const args = process.argv.slice(3);

  ensureDirs();

  switch (cmd) {
    case "create":
      if (!args[0]) { console.log("Usage: lux spec create <name>"); process.exit(1); }
      cmdCreate(args[0]);
      break;

    case "guard":
      cmdGuard(args);
      break;

    case "verify":
      cmdVerify(args);
      break;

    case "check":
      cmdCheck();
      break;

    default:
      console.log(`
LUX Spec CLI — Proof-Driven Development gate

Commands:
  create <name>    Create a spec stub for a function
  guard [name...]  Check spec exists + is fresh (exit 1 if not)
  verify [name...] Run verifier + sign POPDD receipt
  check            Pre-commit: check all modified functions have valid specs

Examples:
  lux spec create calculateDiscount
  lux spec guard calculateDiscount
  lux spec verify calculateDiscount
  lux spec check

Exit codes: 0 = all good, 1 = spec missing/stale/failed
`);
  }
}

main();
