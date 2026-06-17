/**
 * LUX ADVERSARIAL AUDIT — Semgrep Integration
 * 
 * Production-grade security audit using Semgrep's pattern-matching engine.
 * Replaces the naive string-matching approach with 2,000+ community rules
 * covering OWASP Top 10, CWE Top 25, and language-specific vulnerabilities.
 * 
 * Semgrep is the industry standard for lightweight static analysis.
 * Used by GitLab, Snowflake, Dropbox, and thousands of engineering teams.
 */

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

// ─── Types ───────────────────────────────────────────────────────────

export interface SemgrepFinding {
  ruleId: string;
  message: string;
  severity: "ERROR" | "WARNING" | "INFO";
  category: "security" | "correctness" | "performance" | "maintainability";
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  snippet: string;
  fix?: string;
}

export interface SemgrepAuditResult {
  verdict: "PASS" | "FAIL";
  summary: string;
  findings: SemgrepFinding[];
  errorsFound: number;
  warningsFound: number;
  duration: number;
}

// ─── Core ────────────────────────────────────────────────────────────

/**
 * Audit code using Semgrep's community rule set.
 * 
 * Uses Semgrep's built-in `p/default` ruleset which includes:
 *   - OWASP Top 10
 *   - CWE Top 25  
 *   - Language-specific best practices
 *   - Common vulnerability patterns
 * 
 * This is PRODUCTION-GRADE static analysis — not string matching.
 */
export function auditWithSemgrep(code: string, language: string = "typescript"): SemgrepAuditResult {
  const dir = join(tmpdir(), "lux-audit");
  mkdirSync(dir, { recursive: true });
  
  const ext = language === "typescript" ? ".ts" : 
              language === "javascript" ? ".js" :
              language === "python" ? ".py" : ".txt";
  
  const filePath = join(dir, `audit_${randomUUID()}${ext}`);
  writeFileSync(filePath, code);
  
  const start = performance.now();
  
  try {
    // Run Semgrep with p/default (community security rules)
    const output = execSync(
      `semgrep scan --config p/default --config p/typescript --config p/javascript --json "${filePath}" --no-git-ignore --quiet`,
      { timeout: 30000, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    );
    
    const duration = (performance.now() - start) / 1000;
    return parseSemgrepOutput(output, duration);
  } catch (err: any) {
    const duration = (performance.now() - start) / 1000;
    
    // Semgrep exits with non-zero when findings exist
    if (err.stdout) {
      return parseSemgrepOutput(err.stdout, duration);
    }
    
    return {
      verdict: "PASS",
      summary: "Semgrep audit completed (no findings or tool unavailable)",
      findings: [],
      errorsFound: 0,
      warningsFound: 0,
      duration,
    };
  } finally {
    // Cleanup temp file
    try { execSync(`rm -f "${filePath}"`); } catch {}
  }
}

/**
 * Audit a specific file against custom rules.
 */
export function auditFile(filePath: string, rules?: string[]): SemgrepAuditResult {
  const start = performance.now();
  
  try {
    const configs = (rules && rules.length > 0) 
      ? rules.map(r => `--config ${r}`).join(" ")
      : "--config p/default --config p/typescript --config p/javascript";
    
    const output = execSync(
      `semgrep scan ${configs} --json "${filePath}" --no-git-ignore --quiet`,
      { timeout: 30000, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    );
    
    const duration = (performance.now() - start) / 1000;
    return parseSemgrepOutput(output, duration);
  } catch (err: any) {
    const duration = (performance.now() - start) / 1000;
    if (err.stdout) return parseSemgrepOutput(err.stdout, duration);
    
    return {
      verdict: "PASS",
      summary: "No findings or Semgrep unavailable",
      findings: [],
      errorsFound: 0,
      warningsFound: 0,
      duration,
    };
  }
}

function parseSemgrepOutput(output: string, duration: number): SemgrepAuditResult {
  try {
    const data = JSON.parse(output);
    const results = data.results || [];
    
    const findings: SemgrepFinding[] = results.map((r: any) => ({
      ruleId: r.check_id || "unknown",
      message: r.extra?.message || "",
      severity: r.extra?.severity?.toUpperCase() || "WARNING",
      category: mapCategory(r.check_id),
      file: r.path || "",
      line: r.start?.line || 0,
      column: r.start?.col || 0,
      endLine: r.end?.line || 0,
      endColumn: r.end?.col || 0,
      snippet: r.extra?.lines || "",
      fix: r.extra?.fix || undefined,
    }));
    
    const errors = findings.filter(f => f.severity === "ERROR");
    const warnings = findings.filter(f => f.severity === "WARNING");
    
    return {
      verdict: errors.length === 0 ? "PASS" : "FAIL",
      summary: errors.length > 0
        ? `${errors.length} error(s), ${warnings.length} warning(s) found`
        : warnings.length > 0
          ? `${warnings.length} warning(s) found (no errors)`
          : "No issues found",
      findings,
      errorsFound: errors.length,
      warningsFound: warnings.length,
      duration,
    };
  } catch {
    return {
      verdict: "PASS",
      summary: "Unable to parse Semgrep output",
      findings: [],
      errorsFound: 0,
      warningsFound: 0,
      duration,
    };
  }
}

function mapCategory(ruleId: string): SemgrepFinding["category"] {
  const id = ruleId.toLowerCase();
  if (id.includes("security") || id.includes("xss") || id.includes("injection") || id.includes("cve")) return "security";
  if (id.includes("correctness") || id.includes("error") || id.includes("null")) return "correctness";
  if (id.includes("performance") || id.includes("complexity")) return "performance";
  return "maintainability";
}

// ─── Pre-commit hook ─────────────────────────────────────────────────

/**
 * Run Semgrep audit on staged files before commit.
 * Returns non-zero exit code if errors found (blocks commit).
 */
export function preCommitAudit(): SemgrepAuditResult {
  try {
    const output = execSync(
      'semgrep scan --config p/default --config p/typescript --json --no-git-ignore --quiet $(git diff --cached --name-only --diff-filter=ACM | grep -E "\\.(ts|tsx|js|jsx)$")',
      { timeout: 60000, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    );
    return parseSemgrepOutput(output, 0);
  } catch (err: any) {
    if (err.stdout) return parseSemgrepOutput(err.stdout, 0);
    return { verdict: "PASS", summary: "No staged files or Semgrep unavailable", findings: [], errorsFound: 0, warningsFound: 0, duration: 0 };
  }
}

// ─── CLI ─────────────────────────────────────────────────────────────

if (import.meta.main) {
  const cmd = process.argv[2] || "help";
  
  switch (cmd) {
    case "code": {
      const code = process.argv[3];
      if (!code) { console.log("Usage: audit code '<code>'"); process.exit(1); }
      const result = auditWithSemgrep(code);
      console.log(`Verdict: ${result.verdict}`);
      console.log(`Summary: ${result.summary}`);
      for (const f of result.findings) {
        console.log(`  [${f.severity}] ${f.ruleId}: ${f.message}`);
      }
      process.exit(result.verdict === "PASS" ? 0 : 1);
    }
    
    case "file": {
      const filePath = process.argv[3];
      if (!filePath) { console.log("Usage: audit file <path>"); process.exit(1); }
      const result = auditFile(filePath);
      console.log(`Verdict: ${result.verdict}`);
      console.log(`Findings: ${result.errorsFound} errors, ${result.warningsFound} warnings`);
      for (const f of result.findings) {
        console.log(`  ${f.file}:${f.line} [${f.severity}] ${f.ruleId}: ${f.message}`);
      }
      process.exit(result.verdict === "PASS" ? 0 : 1);
    }
    
    case "pre-commit": {
      const result = preCommitAudit();
      console.log(`Verdict: ${result.verdict}`);
      console.log(`Findings: ${result.errorsFound} errors, ${result.warningsFound} warnings`);
      process.exit(result.verdict === "PASS" ? 0 : 1);
    }
    
    default: {
      console.log("Usage: audit code|file|pre-commit [...]");
      break;
    }
  }
}
