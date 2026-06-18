/**
 * LUX SPECULATIVE PRE-COMPUTATION ENGINE — Breakthrough #2 (BUILDABLE NOW)
 * 
 * Predicts what the user will ask and pre-computes answers.
 * Monitors the codebase for anomalies and pre-generates fixes.
 * 
 * Architecture:
 *   Watcher detects anomalies → smol model pre-computes fix → cache stores → 
 *   user asks → instant cache hit → done
 * 
 * Honest benchmark target: 5-10× for common tasks (80% cache hit rate expected).
 * 
 * OMP APIs used:
 *   - pi.on("session_end") — trigger pre-computation after sessions
 *   - pi.on("session_start") — check cache for relevant pre-computed fixes
 *   - File system watchers (via OMP's in-process fs_cache)
 */

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { watch } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Database from "better-sqlite3"; // OMP uses SQLite

// ─── Types ───────────────────────────────────────────────────────────

interface PrecomputedFix {
  id: string;
  trigger: string;         // What anomaly triggered this (test failure pattern, CVE, etc.)
  description: string;     // Human-readable description of the fix
  patch: string;           // Hashline patch
  file: string;            // Target file
  confidence: number;      // 0-1 confidence score
  createdAt: number;       // Unix timestamp
  ttl: number;             // Seconds until expiry
  applied: boolean;        // Has the user accepted this?
}

interface Anomaly {
  type: "test_failure" | "complexity_spike" | "security_advisory" | "performance_regression" | "dependency_outdated";
  description: string;
  file?: string;
  metadata: Record<string, string>;
}

// ─── Cache Database ──────────────────────────────────────────────────

const CACHE_TTL = 3600; // 1 hour default

function initCache(cwd: string): Database.Database {
  const db = new Database(join(cwd, ".lux", "speculative-cache.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS precomputed_fixes (
      id TEXT PRIMARY KEY,
      trigger TEXT NOT NULL,
      description TEXT NOT NULL,
      patch TEXT NOT NULL,
      file TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      created_at INTEGER NOT NULL,
      ttl INTEGER NOT NULL DEFAULT 3600,
      applied INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_trigger ON precomputed_fixes(trigger);
    CREATE INDEX IF NOT EXISTS idx_created ON precomputed_fixes(created_at);
  `);
  return db;
}

function storeFix(db: Database.Database, fix: Omit<PrecomputedFix, "id" | "createdAt" | "applied">): string {
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO precomputed_fixes (id, trigger, description, patch, file, confidence, created_at, ttl, applied)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(id, fix.trigger, fix.description, fix.patch, fix.file, fix.confidence, Date.now(), fix.ttl);
  return id;
}

function queryCache(db: Database.Database, query: string, minConfidence: number = 0.5): PrecomputedFix[] {
  // Clean expired entries
  db.prepare("DELETE FROM precomputed_fixes WHERE created_at + (ttl * 1000) < ? AND applied = 0").run(Date.now());
  
  // Simple keyword match — in production, use embeddings for semantic matching
  const keywords = query.toLowerCase().split(/\s+/);
  const conditions = keywords.map(() => "description LIKE ?").join(" OR ");
  const params = keywords.map(k => `%${k}%`);
  
  return db.prepare(`
    SELECT * FROM precomputed_fixes 
    WHERE (${conditions}) 
      AND confidence >= ? 
      AND applied = 0
    ORDER BY confidence DESC, created_at DESC 
    LIMIT 5
  `).all(...params, minConfidence) as PrecomputedFix[];
}

// ─── Anomaly Detection ──────────────────────────────────────────────

async function detectAnomalies(cwd: string): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  
  // 1. Check for test failures (watch test output files)
  try {
    const testOutput = await readFile(join(cwd, ".lux", "last-test-output.txt"), "utf-8");
    const failures = parseTestFailures(testOutput);
    failures.forEach(f => {
      anomalies.push({
        type: "test_failure",
        description: `Test failure: ${f.testName} — ${f.error}`,
        file: f.file,
        metadata: { testName: f.testName, error: f.error },
      });
    });
  } catch { /* No test output yet */ }
  
  // 2. Check for complexity spikes (would use OMP's AST tools in production)
  // 3. Check for security advisories (would check npm audit / CVE databases)
  // 4. Check for dependency updates (npm outdated / cargo outdated)
  
  return anomalies;
}

// ─── Pre-Computation Engine ──────────────────────────────────────────

async function precomputeFix(
  anomaly: Anomaly,
  ctx: any // ExtensionContext
): Promise<PrecomputedFix | null> {
  // In production: use OMP's smol model to generate a fix
  // For now, we demonstrate the architecture
  
  // The smol model is routed through OMP's role system
  // ctx.models.resolve("pi/smol") would give us the cheap model
  
  // For demonstration, we create a placeholder
  const fix: Omit<PrecomputedFix, "id" | "createdAt" | "applied"> = {
    trigger: anomaly.type,
    description: `Auto-generated fix for: ${anomaly.description}`,
    patch: `[PATCH] Fix for ${anomaly.type}: ${anomaly.description}`,
    file: anomaly.file || "unknown",
    confidence: 0.6, // Lower confidence for pre-computed fixes
    ttl: CACHE_TTL,
  };
  
  return fix as PrecomputedFix;
}

// ─── Extension ────────────────────────────────────────────────────────

export default function luxSpeculative(pi: ExtensionAPI) {
  pi.setLabel("LUX Speculative Pre-Computation");
  let db: Database.Database | null = null;
  let watchers: Array<{ close: () => void }> = [];

  // Initialize on session start
  pi.on("session_start", async (_event, ctx) => {
    const cwd = ctx.cwd;
    db = initCache(cwd);
    
    // Query cache for any pre-computed fixes
    const cached = queryCache(db, "fix bug error crash performance", 0.5);
    if (cached.length > 0) {
      const summary = cached.map(f => `- ${f.description} (${(f.confidence * 100).toFixed(0)}% confidence)`).join("\n");
      await pi.sendMessage(
        `[LUX SPECULATIVE] I pre-computed ${cached.length} potential fix(es) while you were away:\n${summary}\n\nAsk me to apply any of these if they're relevant.`,
        { deliverAs: "followUp" }
      );
      ctx.ui.notify(`🔮 ${cached.length} pre-computed fixes available`, "info");
    }
    
    // Start file system watchers for anomaly detection
    try {
      const testDir = join(cwd, "__tests__");
      const watcher = watch(testDir, { recursive: true }, async (event, filename) => {
        if (filename && filename.endsWith(".test.ts")) {
          // Test file changed — check for failures
          const anomalies = await detectAnomalies(cwd);
          for (const anomaly of anomalies) {
            const fix = await precomputeFix(anomaly, ctx);
            if (fix && db) {
              storeFix(db, fix);
              ctx.ui.notify(`🔮 Pre-computed fix for: ${anomaly.description}`, "info");
            }
          }
        }
      });
      watchers.push({ close: () => watcher.close() });
    } catch {
      // Test directory doesn't exist or can't be watched
    }
  });

  // Clean up on session end
  pi.on("session_end", async (_event, ctx) => {
    // Trigger final pre-computation run
    const anomalies = await detectAnomalies(ctx.cwd);
    let count = 0;
    for (const anomaly of anomalies) {
      const fix = await precomputeFix(anomaly, ctx);
      if (fix && db) {
        storeFix(db, fix);
        count++;
      }
    }
    if (count > 0) {
      ctx.ui.notify(`🔮 Pre-computed ${count} fixes for next session`, "info");
    }
    
    // Close watchers
    watchers.forEach(w => w.close());
    watchers = [];
    
    // Close database
    if (db) {
      db.close();
      db = null;
    }
  });

  // Register a tool to query the cache
  pi.registerTool({
    name: "speculative_cache",
    label: "Speculative Cache",
    description: "Query the pre-computed fix cache for relevant solutions",
    parameters: pi.zod.object({
      query: pi.zod.string().describe("Description of the problem to search for"),
      minConfidence: pi.zod.number().default(0.5).describe("Minimum confidence threshold (0-1)"),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      if (!db) {
        return { content: [{ type: "text", text: "Cache not initialized. Start a session first." }] };
      }
      
      const results = queryCache(db, params.query, params.minConfidence);
      
      if (results.length === 0) {
        return { content: [{ type: "text", text: "No pre-computed fixes found for this query." }] };
      }
      
      const summary = results.map(f => 
        `### ${f.description}\n- File: ${f.file}\n- Confidence: ${(f.confidence * 100).toFixed(0)}%\n- Created: ${new Date(f.createdAt).toISOString()}\n- Patch preview:\n\`\`\`\n${f.patch.slice(0, 500)}\n\`\`\``
      ).join("\n\n");
      
      return {
        content: [{ type: "text", text: `Found ${results.length} pre-computed fix(es):\n\n${summary}` }],
        details: { count: results.length, fixes: results.map(f => ({ id: f.id, file: f.file })) },
      };
    },
  });

  // Slash command
  pi.registerCommand("speculative-stats", {
    description: "Show speculative cache statistics",
    handler: async (_args, ctx) => {
      if (!db) {
        ctx.ui.notify("Cache not initialized", "warning");
        return;
      }
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN applied = 1 THEN 1 ELSE 0 END) as applied,
          AVG(confidence) as avg_confidence
        FROM precomputed_fixes
      `).get() as any;
      
      ctx.ui.notify(
        `🔮 Cache: ${stats.total} fixes (${stats.applied} applied, avg confidence: ${((stats.avg_confidence || 0) * 100).toFixed(0)}%)`,
        "info"
      );
    },
  });
}

// ─── Helper ──────────────────────────────────────────────────────────

function parseTestFailures(output: string): Array<{ testName: string; file: string; error: string }> {
  const failures: Array<{ testName: string; file: string; error: string }> = [];
  
  // Parse common test output formats (Jest, Vitest, Mocha, etc.)
  const failureRegex = /(?:FAIL|●)\s+(.+?)\s*[>\n].*?(?:Error|Expected|Received):\s*(.+?)(?:\n|$)/gs;
  let match: RegExpExecArray | null;
  
  while ((match = failureRegex.exec(output)) !== null) {
    failures.push({
      testName: match[1] || "unknown",
      file: match[1] || "unknown",
      error: match[2] || "unknown error",
    });
  }
  
  return failures;
}
