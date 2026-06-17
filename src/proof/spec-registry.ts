/**
 * SPEC VERSIONING — Critical Fix #1
 * 
 * Prevents stale specs. Every spec is tied to a specific code version.
 * When code changes, specs are flagged for review. CI blocks merges
 * if a modified function has no corresponding spec update.
 * 
 * This is the #1 fix. Stale specs = false confidence = existential risk.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";

// ─── Types ───────────────────────────────────────────────────────────

interface SpecMetadata {
  functionName: string;
  file: string;
  /** SHA256 of the function's source code when the spec was last verified */
  sourceHash: string;
  /** ISO timestamp of last verification */
  lastVerified: string;
  /** Verification result: "PASS" | "FAIL" | "NEEDS_REVIEW" */
  status: "PASS" | "FAIL" | "NEEDS_REVIEW";
  /** Number of edge cases */
  edgeCaseCount: number;
  /** Number of postconditions */
  postconditionCount: number;
  /** Git commit hash when last verified (if available) */
  commitHash?: string;
}

interface SpecRegistry {
  specs: Record<string, SpecMetadata>;
  updatedAt: string;
}

// ─── Registry ────────────────────────────────────────────────────────

const SPEC_DIR = ".lux";
const REGISTRY_FILE = join(SPEC_DIR, "spec-registry.json");
const SPECS_DIR = join(SPEC_DIR, "specs");

function getRegistry(): SpecRegistry {
  mkdirSync(SPEC_DIR, { recursive: true });
  mkdirSync(SPECS_DIR, { recursive: true });
  
  if (existsSync(REGISTRY_FILE)) {
    return JSON.parse(readFileSync(REGISTRY_FILE, "utf-8"));
  }
  
  const empty: SpecRegistry = { specs: {}, updatedAt: new Date().toISOString() };
  writeFileSync(REGISTRY_FILE, JSON.stringify(empty, null, 2));
  return empty;
}

function saveRegistry(registry: SpecRegistry): void {
  registry.updatedAt = new Date().toISOString();
  writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
}

// ─── Core Functions ──────────────────────────────────────────────────

/**
 * Register a spec for a function.
 * Called when a spec is first created or updated.
 */
export function registerSpec(
  functionName: string,
  filePath: string,
  sourceCode: string,
  edgeCaseCount: number,
  postconditionCount: number,
  commitHash?: string,
): SpecMetadata {
  const registry = getRegistry();
  const sourceHash = createHash("sha256").update(sourceCode).digest("hex").slice(0, 16);
  
  const metadata: SpecMetadata = {
    functionName,
    file: relative(process.cwd(), filePath),
    sourceHash,
    lastVerified: new Date().toISOString(),
    status: "PASS",
    edgeCaseCount,
    postconditionCount,
    commitHash,
  };
  
  registry.specs[functionName] = metadata;
  saveRegistry(registry);
  
  return metadata;
}

/**
 * Check if a spec is stale.
 * A spec is stale if the source code has changed since last verification.
 * 
 * CRITICAL: This function runs in CI. If it returns NEEDS_REVIEW,
 * the PR should be BLOCKED until the spec is updated.
 */
export function checkSpecStaleness(
  functionName: string,
  currentSourceCode: string,
): { status: "PASS" | "FAIL" | "NEEDS_REVIEW"; metadata: SpecMetadata | null } {
  const registry = getRegistry();
  const metadata = registry.specs[functionName];
  
  if (!metadata) {
    // No spec exists for this function — needs one
    return { status: "NEEDS_REVIEW", metadata: null };
  }
  
  const currentHash = createHash("sha256").update(currentSourceCode).digest("hex").slice(0, 16);
  
  if (currentHash !== metadata.sourceHash) {
    // Source has changed — spec needs review
    metadata.status = "NEEDS_REVIEW";
    registry.specs[functionName] = metadata;
    saveRegistry(registry);
    return { status: "NEEDS_REVIEW", metadata };
  }
  
  return { status: metadata.status, metadata };
}

/**
 * Get all specs that need review (stale or failed).
 * Run this in CI to block merges.
 */
export function getStaleSpecs(): SpecMetadata[] {
  const registry = getRegistry();
  return Object.values(registry.specs).filter(
    s => s.status === "NEEDS_REVIEW" || s.status === "FAIL"
  );
}

/**
 * Get all specs for a file.
 * When a file is modified, check all its specs.
 */
export function getSpecsForFile(filePath: string): SpecMetadata[] {
  const registry = getRegistry();
  const relPath = relative(process.cwd(), filePath);
  return Object.values(registry.specs).filter(s => s.file === relPath);
}

/**
 * Update spec verification status after running verifier.
 */
export function updateSpecStatus(
  functionName: string,
  sourceCode: string,
  passed: boolean,
  edgeCaseCount: number,
  postconditionCount: number,
): SpecMetadata {
  const registry = getRegistry();
  const sourceHash = createHash("sha256").update(sourceCode).digest("hex").slice(0, 16);
  
  const metadata: SpecMetadata = {
    functionName,
    file: registry.specs[functionName]?.file || "unknown",
    sourceHash,
    lastVerified: new Date().toISOString(),
    status: passed ? "PASS" : "FAIL",
    edgeCaseCount,
    postconditionCount,
  };
  
  registry.specs[functionName] = metadata;
  saveRegistry(registry);
  
  return metadata;
}

// ─── CLI ─────────────────────────────────────────────────────────────

if (import.meta.main) {
  const cmd = process.argv[2];
  const registry = getRegistry();
  
  switch (cmd) {
    case "list": {
      console.log(`\n📋 Spec Registry — ${Object.keys(registry.specs).length} specs\n`);
      for (const [name, meta] of Object.entries(registry.specs)) {
        const icon = meta.status === "PASS" ? "✅" : meta.status === "FAIL" ? "❌" : "⚠️";
        console.log(`  ${icon} ${name}`);
        console.log(`     File: ${meta.file}`);
        console.log(`     Hash: ${meta.sourceHash}`);
        console.log(`     Edge cases: ${meta.edgeCaseCount} | Postconditions: ${meta.postconditionCount}`);
        console.log(`     Last verified: ${meta.lastVerified}`);
        console.log(`     Status: ${meta.status}\n`);
      }
      break;
    }
    
    case "stale": {
      const stale = getStaleSpecs();
      if (stale.length === 0) {
        console.log("✅ All specs up to date.\n");
        process.exit(0);
      }
      console.log(`\n⚠️  ${stale.length} stale spec(s) need review:\n`);
      for (const s of stale) {
        console.log(`  ⚠️  ${s.functionName} (${s.file}) — ${s.status}`);
      }
      console.log("\nRun verification to update specs, or review and update manually.\n");
      process.exit(1); // Non-zero exit blocks CI
      break;
    }
    
    case "check": {
      const fnName = process.argv[3];
      if (!fnName) {
        console.log("Usage: spec-registry check <functionName>");
        process.exit(1);
      }
      const meta = registry.specs[fnName];
      if (!meta) {
        console.log(`No spec found for '${fnName}'`);
        process.exit(1);
      }
      console.log(JSON.stringify(meta, null, 2));
      break;
    }
    
    default: {
      console.log("Usage: spec-registry [list|stale|check <name>]");
      break;
    }
  }
}
