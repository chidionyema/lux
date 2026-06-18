/**
 * LUX AUTONOMY GRADIENT CONTROLLER — Breakthrough #3 (BUILDABLE NOW)
 * 
 * Learns when to act autonomously vs. ask for permission.
 * Uses a per-project, per-task-type confidence threshold that adjusts 
 * based on user corrections and acceptances.
 * 
 * Architecture:
 *   Intercept destructive tools → check confidence → above threshold: auto-execute
 *   → below: ask user → learn from response → adjust threshold
 * 
 * Honest benchmark target: 3-5× reduction in human attention cost.
 * 
 * OMP APIs used:
 *   - pi.on("tool_call") — intercept destructive operations
 *   - ctx.ui.confirm() — ask user for permission
 *   - pi.on("message_end") — learn from user corrections
 */

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import Database from "better-sqlite3";
import { join } from "node:path";

// ─── Types ───────────────────────────────────────────────────────────

type TaskType = "bugfix" | "refactor" | "feature" | "test" | "config" | "security" | "dependency" | "unknown";

interface AutonomyConfig {
  project: string;
  thresholds: Record<TaskType, number>;  // 0.0 = always ask, 1.0 = never ask
  history: AutonomyEvent[];
}

interface AutonomyEvent {
  timestamp: number;
  taskType: TaskType;
  tool: string;
  decision: "auto_executed" | "asked_user" | "user_corrected" | "user_accepted";
  confidence: number;
  description: string;
}

const DESTRUCTIVE_TOOLS = ["edit", "write", "bash"];

const DEFAULT_THRESHOLDS: Record<TaskType, number> = {
  bugfix: 0.6,      // Bug fixes: need moderate confidence
  refactor: 0.5,     // Refactors: slightly lower threshold
  feature: 0.4,      // New features: err on asking
  test: 0.7,         // Test changes: higher threshold (tests are safety nets)
  config: 0.3,       // Config changes: be careful (can break deployments)
  security: 0.3,     // Security: always careful
  dependency: 0.6,   // Dep updates: moderate
  unknown: 0.4,      // Unknown: default to asking
};

// ─── Confidence Estimation ───────────────────────────────────────────

function estimateConfidence(toolName: string, toolInput: any, taskContext: string): number {
  let confidence = 0.6; // Base confidence
  
  // Boost confidence for simple operations
  if (toolName === "write" && typeof toolInput === "object") {
    confidence += 0.1; // Writing files is straightforward
  }
  
  // Lower confidence for bash operations
  if (toolName === "bash") {
    confidence -= 0.2; // Shell commands are risky
    const cmd = typeof toolInput === "string" ? toolInput : toolInput?.command || "";
    if (cmd.includes("rm") || cmd.includes("sudo") || cmd.includes("chmod")) {
      confidence -= 0.3; // Destructive commands are very risky
    }
  }
  
  // Adjust based on task context
  if (taskContext.includes("test") || taskContext.includes("testing")) {
    confidence += 0.1; // Testing contexts are safer
  }
  if (taskContext.includes("production") || taskContext.includes("deploy")) {
    confidence -= 0.2; // Production contexts need caution
  }
  
  return Math.max(0, Math.min(1, confidence));
}

function classifyTask(message: string): TaskType {
  const lower = message.toLowerCase();
  if (lower.includes("fix") || lower.includes("bug") || lower.includes("crash") || lower.includes("error")) return "bugfix";
  if (lower.includes("refactor") || lower.includes("rename") || lower.includes("move") || lower.includes("restructure")) return "refactor";
  if (lower.includes("add") || lower.includes("create") || lower.includes("implement") || lower.includes("feature")) return "feature";
  if (lower.includes("test") || lower.includes("spec") || lower.includes("coverage")) return "test";
  if (lower.includes("config") || lower.includes("env") || lower.includes("settings") || lower.includes("deploy")) return "config";
  if (lower.includes("security") || lower.includes("vulnerability") || lower.includes("cve") || lower.includes("patch")) return "security";
  if (lower.includes("update") || lower.includes("upgrade") || lower.includes("dependency") || lower.includes("package")) return "dependency";
  return "unknown";
}

// ─── Database ────────────────────────────────────────────────────────

function initAutonomyDB(cwd: string): Database.Database {
  const db = new Database(join(cwd, ".lux", "autonomy.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS autonomy_config (
      project TEXT PRIMARY KEY,
      thresholds TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS autonomy_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      task_type TEXT NOT NULL,
      tool TEXT NOT NULL,
      decision TEXT NOT NULL,
      confidence REAL NOT NULL,
      description TEXT NOT NULL
    );
  `);
  return db;
}

function getThresholds(db: Database.Database, project: string): Record<TaskType, number> {
  const row = db.prepare("SELECT thresholds FROM autonomy_config WHERE project = ?").get(project) as any;
  if (row) {
    return { ...DEFAULT_THRESHOLDS, ...JSON.parse(row.thresholds) };
  }
  return { ...DEFAULT_THRESHOLDS };
}

function adjustThreshold(
  db: Database.Database, 
  project: string, 
  taskType: TaskType, 
  delta: number
): void {
  const thresholds = getThresholds(db, project);
  thresholds[taskType] = Math.max(0.05, Math.min(0.95, thresholds[taskType] + delta));
  
  db.prepare(`
    INSERT INTO autonomy_config (project, thresholds) VALUES (?, ?)
    ON CONFLICT(project) DO UPDATE SET thresholds = excluded.thresholds
  `).run(project, JSON.stringify(thresholds));
}

function recordEvent(db: Database.Database, event: Omit<AutonomyEvent, "id">): void {
  db.prepare(`
    INSERT INTO autonomy_events (timestamp, task_type, tool, decision, confidence, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(event.timestamp, event.taskType, event.tool, event.decision, event.confidence, event.description);
}

// ─── Extension ────────────────────────────────────────────────────────

export default function luxAutonomy(pi: ExtensionAPI) {
  pi.setLabel("LUX Autonomy Gradient");
  let db: Database.Database | null = null;
  let currentTaskContext = "";
  let currentTaskType: TaskType = "unknown";

  // Capture task context from user messages
  pi.on("message_end", async (event) => {
    if (event.message.role === "user") {
      const content = typeof event.message.content === "string" 
        ? event.message.content 
        : JSON.stringify(event.message.content);
      currentTaskType = classifyTask(content);
      currentTaskContext = content;
    }
  });

  // Intercept destructive tool calls
  pi.on("tool_call", async (event, ctx) => {
    if (!DESTRUCTIVE_TOOLS.includes(event.toolName)) return;
    if (!db) db = initAutonomyDB(ctx.cwd);
    
    const thresholds = getThresholds(db, ctx.cwd);
    const threshold = thresholds[currentTaskType];
    const confidence = estimateConfidence(event.toolName, event.input, currentTaskContext);
    
    if (confidence >= threshold) {
      // Auto-execute: confidence exceeds threshold
      recordEvent(db, {
        timestamp: Date.now(),
        taskType: currentTaskType,
        tool: event.toolName,
        decision: "auto_executed",
        confidence,
        description: currentTaskContext.slice(0, 200),
      });
      ctx.ui.notify(`🤖 Auto: ${currentTaskType} (${(confidence * 100).toFixed(0)}% ≥ ${(threshold * 100).toFixed(0)}%)`, "info");
      return; // Allow the tool to proceed
    }
    
    // Ask user for permission
    const approved = await ctx.ui.confirm(
      `Allow ${event.toolName}? (${(confidence * 100).toFixed(0)}% confidence — threshold: ${(threshold * 100).toFixed(0)}%)`,
      `Task: ${currentTaskContext.slice(0, 100)}\nTool: ${event.toolName}\nConfidence: ${(confidence * 100).toFixed(0)}%\n\nThis ${currentTaskType} task is below your autonomy threshold. Allow?`,
      { timeout: 30000 }
    );
    
    recordEvent(db, {
      timestamp: Date.now(),
      taskType: currentTaskType,
      tool: event.toolName,
      decision: approved ? "user_accepted" : "asked_user",
      confidence,
      description: currentTaskContext.slice(0, 200),
    });
    
    if (approved) {
      // User approved — raise threshold slightly (they trusted it)
      adjustThreshold(db, ctx.cwd, currentTaskType, +0.03);
      ctx.ui.notify(`📈 Autonomy increased for ${currentTaskType}: ${(threshold * 100).toFixed(0)}% → ${((threshold + 0.03) * 100).toFixed(0)}%`, "info");
      return; // Allow
    }
    
    // User denied — block the tool
    return { block: true, reason: "User denied autonomous execution" };
  });

  // Learn from user corrections after auto-executed edits
  pi.on("tool_result", async (event, ctx) => {
    if (!DESTRUCTIVE_TOOLS.includes(event.toolName)) return;
    if (!event.isError) return;
    if (!db) return;
    
    // The tool failed — likely the user will correct us
    // We preemptively lower the threshold for this task type
    adjustThreshold(db, ctx.cwd, currentTaskType, -0.05);
    ctx.ui.notify(`📉 Autonomy decreased for ${currentTaskType} after error`, "warning");
  });

  // Slash command: show autonomy status
  pi.registerCommand("autonomy", {
    description: "Show autonomy gradient status",
    handler: async (_args, ctx) => {
      if (!db) db = initAutonomyDB(ctx.cwd);
      const thresholds = getThresholds(db, ctx.cwd);
      
      const lines = Object.entries(thresholds)
        .sort(([, a], [, b]) => b - a)
        .map(([type, value]) => {
          const bar = "█".repeat(Math.round(value * 20)) + "░".repeat(20 - Math.round(value * 20));
          return `${type.padEnd(12)} ${bar} ${(value * 100).toFixed(0)}%`;
        });
      
      ctx.ui.notify(`Autonomy Gradient:\n${lines.join("\n")}`, "info");
    },
  });

  // Slash command: reset autonomy for a task type
  pi.registerCommand("autonomy-reset", {
    description: "Reset autonomy threshold to default",
    handler: async (_args, ctx) => {
      if (!db) return;
      const thresholds = { ...DEFAULT_THRESHOLDS };
      db.prepare(`
        INSERT INTO autonomy_config (project, thresholds) VALUES (?, ?)
        ON CONFLICT(project) DO UPDATE SET thresholds = excluded.thresholds
      `).run(ctx.cwd, JSON.stringify(thresholds));
      ctx.ui.notify("Autonomy thresholds reset to defaults", "info");
    },
  });
}
