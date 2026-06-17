/**
 * SPEC STALENESS GATE — Part of npm test
 * 
 * This test fails if any registered specs are stale.
 * CI will block merges that modify functions without updating specs.
 * 
 * FIXES: Critical issue #7 — stale specs = false confidence
 */

import { describe, test, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("SPEC STALENESS GATE", () => {
  const REGISTRY_FILE = join(process.cwd(), ".lux", "spec-registry.json");

  test("Spec registry file exists (created on first spec registration)", () => {
    // This is informational — registry is created when first spec is registered.
    // If it doesn't exist, no specs have been registered yet (not a failure).
    if (!existsSync(REGISTRY_FILE)) {
      console.log("ℹ️  No spec registry yet — create specs to enable staleness checking.");
    }
    // Not a hard failure — skip if no specs exist
  });

  test("NO STALE SPECS — all registered specs must be up to date", () => {
    if (!existsSync(REGISTRY_FILE)) {
      // No specs registered — nothing to check, test passes
      return;
    }

    const registry = JSON.parse(readFileSync(REGISTRY_FILE, "utf-8"));
    const specs = registry.specs || {};

    if (Object.keys(specs).length === 0) {
      console.log("ℹ️  No specs registered yet.");
      return;
    }

    const stale = Object.entries(specs)
      .filter(([_, meta]: [string, any]) => meta.status === "NEEDS_REVIEW" || meta.status === "FAIL")
      .map(([name, meta]: [string, any]) => ({ name, ...meta }));

    if (stale.length > 0) {
      console.log(`\n❌ ${stale.length} STALE SPEC(S) FOUND:\n`);
      for (const s of stale) {
        console.log(`  ⚠️  ${s.name}`);
        console.log(`     File: ${s.file}`);
        console.log(`     Status: ${s.status}`);
        console.log(`     Last verified: ${s.lastVerified}`);
        console.log(`     Edge cases: ${s.edgeCaseCount} | Postconditions: ${s.postconditionCount}\n`);
      }
      console.log("Run verification to update specs:");
      console.log("  npx tsx src/proof/spec-registry.ts list\n");
    }

    // BLOCK if stale specs exist
    expect(stale).toHaveLength(0);
  });

  test("All specs have at least 3 edge cases (minimum quality threshold)", () => {
    if (!existsSync(REGISTRY_FILE)) return;

    const registry = JSON.parse(readFileSync(REGISTRY_FILE, "utf-8"));
    const specs = registry.specs || {};

    const weak = Object.entries(specs)
      .filter(([_, meta]: [string, any]) => (meta.edgeCaseCount || 0) < 3)
      .map(([name, meta]: [string, any]) => ({ name, edgeCaseCount: meta.edgeCaseCount }));

    if (weak.length > 0) {
      console.log(`\n⚠️  ${weak.length} spec(s) have fewer than 3 edge cases:\n`);
      for (const w of weak) {
        console.log(`  ${w.name}: ${w.edgeCaseCount} edge case(s) — add at least ${3 - w.edgeCaseCount} more`);
      }
      console.log("");
    }

    // Warning only — don't block on quality threshold (yet)
    expect(weak.length).toBe(0);
  });
});
