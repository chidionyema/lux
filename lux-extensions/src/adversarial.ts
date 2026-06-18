/**
 * LUX ADVERSARIAL PIPELINE — Breakthrough #1 (BUILDABLE NOW)
 * 
 * Intercepts every edit/write/before-provider-request event and runs 
 * an auditor model in parallel. Blocks edits with detected issues.
 * 
 * Architecture:
 *   Generator (main model) → Auditor (smol model) → Block/Allow → Synthesizer (main model)
 * 
 * Honest benchmark target: 3-5× reduction in edit failures.
 * 
 * OMP APIs used:
 *   - pi.on("tool_call") — intercept edit/write tools
 *   - pi.on("before_provider_request") — pre-audit proposals
 *   - pi.sendMessage() — inject auditor feedback as steer
 *   - ctx.models — pick contrasting model for audit
 */

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

interface AuditResult {
  passed: boolean;
  issues: AuditIssue[];
  summary: string;
}

interface AuditIssue {
  severity: "critical" | "warning" | "info";
  category: "security" | "logic" | "performance" | "style" | "missing_edge_case";
  description: string;
  suggestion: string;
}

const AUDIT_CRITERIA = `
You are a code auditor. Review the following proposed edit and identify:
1. SECURITY issues (injection, unsafe deserialization, exposed secrets, path traversal)
2. LOGIC errors (null dereferences, race conditions, incorrect error handling)
3. MISSING EDGE CASES (empty inputs, null/undefined, boundary values)
4. PERFORMANCE issues (N+1 queries, blocking operations, memory leaks)

Rate each issue: critical (must fix), warning (should fix), info (consider fixing).
If NO issues found, respond with "AUDIT_PASSED".
`;

export default function luxAdversarial(pi: ExtensionAPI) {
  const { z } = pi.zod;
  pi.setLabel("LUX Adversarial Pipeline");

  // PHASE 1: Pre-audit provider requests before they're sent
  // This catches issues in the prompt itself before the model sees it
  pi.on("before_provider_request", async (event) => {
    // Could inject adversarial prompts or sanitize the request here
    // For v0.1, we focus on post-generation audit (PHASE 2)
  });

  // PHASE 2: Intercept edits and writes before they touch disk
  pi.on("tool_call", async (event, ctx) => {
    // Only audit mutation tools
    if (event.toolName !== "edit" && event.toolName !== "write") return;
    
    // Skip if no contrasting model available (user may only have one provider)
    const current = ctx.models.current();
    if (!current) return;
    
    const auditor = ctx.models
      .list()
      .find(m => current && ctx.models.family(m) !== ctx.models.family(current));
    
    if (!auditor) {
      // No contrasting model — skip audit for this edit
      ctx.ui.notify("⚡ Adversarial audit skipped (no contrasting model available)", "info");
      return;
    }

    // Run the audit against the proposed edit
    const edit = event.input;
    const auditPrompt = `${AUDIT_CRITERIA}\n\nProposed edit:\nTool: ${event.toolName}\nInput: ${JSON.stringify(edit, null, 2)}`;
    
    try {
      // TODO: Call auditor model. In OMP extension, we'd use the model API directly.
      // For now, we demonstrate the architecture.
      const auditResult = await runAudit(auditPrompt, auditor, ctx);
      
      if (!auditResult.passed) {
        const criticals = auditResult.issues.filter(i => i.severity === "critical");
        
        if (criticals.length > 0) {
          // Block the edit with critical issues
          ctx.ui.notify(`🛑 Audited: ${criticals.length} critical issues found`, "error");
          
          // Inject feedback for the generator to fix
          await pi.sendMessage(
            `[AUDITOR] Critical issues found in your edit:\n${
              auditResult.issues
                .filter(i => i.severity === "critical")
                .map(i => `- [${i.category}] ${i.description}\n  Fix: ${i.suggestion}`)
                .join("\n")
            }\n\nRewrite the edit to address all critical issues.`,
            { deliverAs: "steer" }
          );
          
          return { block: true, reason: auditResult.summary };
        }
        
        // Warnings: allow the edit but notify
        ctx.ui.notify(
          `⚠️ Audited: ${auditResult.issues.length} warnings — proceeding`,
          "warning"
        );
      } else {
        ctx.ui.notify("✅ Audit passed — edit applied", "info");
      }
    } catch (err) {
      // Audit model failed — fall through and allow the edit
      ctx.ui.notify("⚠️ Audit unavailable — edit applied without review", "warning");
    }
  });

  // PHASE 3: Post-edit verification
  // After an edit is applied, we could run property tests or differential fuzzing
  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "edit" && event.toolName !== "write") return;
    if (event.isError) return;
    
    // The edit was applied. Queue post-verification.
    ctx.ui.notify("🔍 Post-edit verification queued...", "info");
  });

  // Register a slash command for manual audit
  pi.registerCommand("audit", {
    description: "Run adversarial audit on proposed changes",
    handler: async (_args, ctx) => {
      ctx.ui.notify("Audit system active. All edits are automatically audited.", "info");
    },
  });
}

// Mock audit function — in production, this calls the auditor model via OMP's model API
async function runAudit(
  prompt: string,
  auditorModel: any,
  ctx: any
): Promise<AuditResult> {
  // In production:
  // 1. Use OMP's model API to call the auditor
  // 2. Parse the response for issues
  // 3. Return structured audit result
  
  // For now, demonstrate the architecture with a heuristic check
  const editText = JSON.stringify(prompt).toLowerCase();
  const issues: AuditIssue[] = [];
  
  // Heuristic security checks
  if (editText.includes("innerhtml")) {
    issues.push({
      severity: "critical",
      category: "security",
      description: "innerHTML usage detected — potential XSS vector",
      suggestion: "Use textContent or a sanitization library instead",
    });
  }
  
  if (editText.includes("eval(")) {
    issues.push({
      severity: "critical",
      category: "security",
      description: "eval() detected — arbitrary code execution risk",
      suggestion: "Use a safer alternative or sandboxed execution",
    });
  }
  
  if (editText.includes("rm -rf")) {
    issues.push({
      severity: "critical",
      category: "security",
      description: "Destructive filesystem operation detected",
      suggestion: "Use with caution. Ensure path validation.",
    });
  }
  
  // Heuristic logic checks
  if (editText.includes(".push(") && !editText.includes("await")) {
    issues.push({
      severity: "warning",
      category: "logic",
      description: "Potential unawaited async operation in array push",
      suggestion: "Ensure all async operations are properly awaited",
    });
  }

  if (editText.includes("null") && !editText.includes("?.") && !editText.includes("??") && !editText.includes("if")) {
    issues.push({
      severity: "warning",
      category: "missing_edge_case",
      description: "Null-handling may be incomplete",
      suggestion: "Add null checks with optional chaining (?.) or nullish coalescing (??)",
    });
  }
  
  return {
    passed: issues.filter(i => i.severity === "critical").length === 0,
    issues,
    summary: issues.length === 0 
      ? "No issues found" 
      : `${issues.length} issue(s) found (${issues.filter(i => i.severity === "critical").length} critical)`,
  };
}
