/**
 * LUX Spec Linter — catches the "throws on baseline input" trap
 *
 * The SpecVerifier explicitly tests every precondition with undefined,
 * null, and {} as input. If your precondition throws on any of these
 * (instead of returning false), the spec will silently fail validation
 * with a confusing "Precondition throws on baseline input" error.
 *
 * This linter runs the same baseline checks statically and warns you
 * before you ship a broken spec.
 *
 * Usage:
 *   import { lintSpec } from "./proof/spec-linter";
 *   const issues = lintSpec(mySpec);
 *   if (issues.length > 0) console.warn(...);
 */

import type { FunctionSpec, Precondition, Postcondition, Invariant } from "./spec.js";

export type LintSeverity = "error" | "warning" | "info";

export interface LintIssue {
  severity: LintSeverity;
  clauseType: "precondition" | "postcondition" | "invariant" | "edgeCase";
  clauseName: string;
  message: string;
  hint?: string;
}

/**
 * Static analysis of a FunctionSpec. Returns an array of issues.
 *
 * The baseline test: does the clause function throw when called with
 * undefined, null, or {} as input? If yes, warn the user.
 *
 * The check is heuristic — we execute the function with each baseline
 * input in a try/catch. If it throws, we report it.
 */
export function lintSpec<TInput, TOutput>(
  spec: FunctionSpec<TInput, TOutput>,
): LintIssue[] {
  const issues: LintIssue[] = [];

  for (const pre of spec.preconditions) {
    issues.push(...checkBaseline(pre as Precondition<unknown>, "precondition"));
  }

  for (const post of spec.postconditions) {
    issues.push(...checkPostBaseline(post as Postcondition<unknown, unknown>));
  }

  for (const inv of spec.invariants) {
    issues.push(...checkInvariantBaseline(inv as Invariant<unknown, unknown>));
  }

  if (spec.edgeCases.length === 0) {
    issues.push({
      severity: "warning",
      clauseType: "edgeCase",
      clauseName: spec.functionName,
      message: "No edge cases defined",
      hint: "Add at least 3 edge cases: empty input, single element, typical input, boundary value",
    });
  }

  return issues;
}

function checkBaseline(
  clause: Precondition<unknown>,
  type: "precondition",
): LintIssue[] {
  const issues: LintIssue[] = [];

  for (const baseline of [undefined, null, {}]) {
    try {
      clause.check(baseline);
    } catch (e) {
      issues.push({
        severity: "error",
        clauseType: type,
        clauseName: clause.name,
        message: `Precondition throws on baseline input ${JSON.stringify(baseline)}: ${(e as Error).message}`,
        hint: `Guard with Array.isArray() / typeof checks, or return false for invalid input`,
      });
    }
  }

  return issues;
}

function checkPostBaseline(
  clause: Postcondition<unknown, unknown>,
): LintIssue[] {
  const issues: LintIssue[] = [];

  // Postconditions receive (input, output). Test with weird inputs and outputs.
  for (const baseline of [undefined, null, {}]) {
    try {
      clause.check(baseline, baseline);
    } catch (e) {
      issues.push({
        severity: "error",
        clauseType: "postcondition",
        clauseName: clause.name,
        message: `Postcondition throws on baseline input ${JSON.stringify(baseline)}: ${(e as Error).message}`,
        hint: `Guard with Array.isArray() / typeof checks, or return true for invalid input`,
      });
    }
  }

  return issues;
}

function checkInvariantBaseline(
  clause: Invariant<unknown, unknown>,
): LintIssue[] {
  const issues: LintIssue[] = [];

  // Invariants also receive (input, output). They are tested with random
  // samples, but the spec verifier may call them with garbage on baseline.
  for (const baseline of [undefined, null, {}]) {
    try {
      clause.check(baseline, undefined);
    } catch (e) {
      issues.push({
        severity: "warning",
        clauseType: "invariant",
        clauseName: clause.name,
        message: `Invariant throws on baseline input: ${(e as Error).message}`,
        hint: `Invariants are tested against random samples, but may receive undefined; consider guarding`,
      });
    }
  }

  if (!clause.arbitrary) {
    issues.push({
      severity: "error",
      clauseType: "invariant",
      clauseName: clause.name,
      message: "Invariant has no `arbitrary()` generator",
      hint: "Invariants need an arbitrary() function that returns a valid sample input",
    });
  }

  return issues;
}

/**
 * Convenience: print lint issues to console.
 */
export function printLintIssues(issues: LintIssue[]): void {
  if (issues.length === 0) {
    console.log("✅ Spec lint: no issues found");
    return;
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const infos = issues.filter((i) => i.severity === "info");

  for (const i of [...errors, ...warnings, ...infos]) {
    const icon = i.severity === "error" ? "❌" : i.severity === "warning" ? "⚠️" : "ℹ️";
    console.log(`${icon} [${i.clauseType}/${i.clauseName}] ${i.message}`);
    if (i.hint) console.log(`   💡 ${i.hint}`);
  }

  console.log(`\nLint summary: ${errors.length} error(s), ${warnings.length} warning(s), ${infos.length} info`);
}
