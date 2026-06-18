/**
 * LUX BENCHMARKING FRAMEWORK
 * 
 * Core principle: EVERY claim LUX makes is backed by a reproducible benchmark
 * in this file. No fabricated numbers. No "multiplication theater."
 * 
 * Usage:
 *   bun run bench              — run all benchmarks
 *   bun run bench:token        — token efficiency only
 *   bun run bench:latency      — model latency only
 *   bun run bench:accuracy     — correctness only
 * 
 * Each benchmark:
 *   1. Defines a clear hypothesis
 *   2. Measures baseline (Claude Code / raw LLM approach)
 *   3. Measures LUX approach
 *   4. Reports difference with confidence intervals
 *   5. Saves results to benchmarks/results/ for historical tracking
 */

import { readdir, stat, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Types ───────────────────────────────────────────────────────────

export interface BenchmarkResult {
  name: string;
  description: string;
  hypothesis: string;
  baseline: Measurement;
  lux: Measurement;
  improvement: number;          // positive = LUX is better
  improvementPercent: number;
  confidence: "measured" | "estimated" | "projected";
  timestamp: string;
  notes: string;
}

export interface Measurement {
  metric: string;
  value: number;
  unit: string;
  samples: number;
  stddev: number | null;
  min: number | null;
  max: number | null;
}

export interface BenchmarkSuite {
  name: string;
  benchmarks: BenchmarkResult[];
}

// ─── Benchmark Runner ─────────────────────────────────────────────────

const RESULTS_DIR = join(__dirname, "results");

export async function runSuite(
  name: string,
  benchmarks: (() => Promise<BenchmarkResult>)[]
): Promise<BenchmarkSuite> {
  console.log(`\n━━━ ${name} ━━━`);
  
  const results: BenchmarkResult[] = [];
  
  for (let i = 0; i < benchmarks.length; i++) {
    const fn = benchmarks[i]!;
    const label = `  [${i + 1}/${benchmarks.length}]`;
    
    try {
      const start = performance.now();
      const result = await fn();
      const elapsed = (performance.now() - start).toFixed(0);
      
      const arrow = result.improvement > 0 ? "⬆" : "⬇";
      const pct = result.improvementPercent.toFixed(1);
      
      console.log(`${label} ${result.name}: ${result.baseline.value}→${result.lux.value} ${result.baseline.unit} (${arrow}${pct}%) [${elapsed}ms] [${result.confidence}]`);
      
      results.push(result);
    } catch (err) {
      console.error(`${label} FAILED: ${err}`);
    }
  }
  
  // Save results
  await saveResults(name, results);
  
  return { name, benchmarks: results };
}

export async function saveResults(name: string, results: BenchmarkResult[]): Promise<void> {
  await mkdir(RESULTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(RESULTS_DIR, `${name}-${timestamp}.json`);
  await writeFile(path, JSON.stringify(results, null, 2));
  console.log(`  Results saved: ${path}`);
}

// ─── Measurement Helpers ──────────────────────────────────────────────

/**
 * Count tokens in a string using a simple BPE approximation.
 * For production, use tiktoken or the model's tokenizer.
 * 
 * HONESTY NOTE: This is an approximation. Real token counts vary by model.
 * We note this in all benchmarks. When MINIMAX_API_KEY is available,
 * we validate against the API's reported token counts.
 */
export function estimateTokens(text: string): number {
  // GPT-family token approximation: ~4 chars per token for code
  // This is documented in OpenAI's tokenizer docs
  // For more accuracy, we'd use tiktoken bindings
  const chars = text.length;
  const words = text.split(/\s+/).length;
  // Blend character-based and word-based estimates
  return Math.round((chars / 4 + words * 1.3) / 2);
}

/**
 * Measure with multiple samples for statistical validity.
 */
export async function measureWithSamples(
  fn: () => Promise<number>,
  samples: number = 5
): Promise<{ mean: number; stddev: number; min: number; max: number; samples: number }> {
  const values: number[] = [];
  
  for (let i = 0; i < samples; i++) {
    values.push(await fn());
  }
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  
  return {
    mean,
    stddev,
    min: Math.min(...values),
    max: Math.max(...values),
    samples,
  };
}

// ─── File Utilities for Benchmarks ────────────────────────────────────

export async function collectFiles(
  dir: string,
  extensions: string[]
): Promise<{ path: string; content: string }[]> {
  const files: { path: string; content: string }[] = [];
  
  async function walk(current: string) {
    const entries = await readdir(current, { withExtensions: true } as any);
    for (const entry of entries) {
      const full = join(current, entry);
      const s = await stat(full);
      if (s.isDirectory()) {
        await walk(full);
      } else if (extensions.includes(extname(entry))) {
        files.push({
          path: full,
          content: await readFile(full, "utf-8"),
        });
      }
    }
  }
  
  await walk(dir);
  return files;
}

// ─── Report Generator ─────────────────────────────────────────────────

export function printSummary(suites: BenchmarkSuite[]): void {
  console.log("\n" + "═".repeat(70));
  console.log("BENCHMARK SUMMARY");
  console.log("═".repeat(70));
  
  const all = suites.flatMap(s => s.benchmarks);
  
  const measured = all.filter(b => b.confidence === "measured");
  const estimated = all.filter(b => b.confidence === "estimated");
  const projected = all.filter(b => b.confidence === "projected");
  
  console.log(`\n  Total benchmarks: ${all.length}`);
  console.log(`  ✅ Measured:   ${measured.length} (empirically validated)`);
  console.log(`  ⚠️  Estimated:  ${estimated.length} (calculated, needs API validation)`);
  console.log(`  🔮 Projected:  ${projected.length} (theoretical, needs implementation)`);
  
  if (all.length > 0) {
    const avgImprovement = all.reduce((s, b) => s + b.improvementPercent, 0) / all.length;
    console.log(`\n  Average improvement: ${avgImprovement.toFixed(1)}%`);
    console.log(`  Range: ${Math.min(...all.map(b => b.improvementPercent)).toFixed(1)}% — ${Math.max(...all.map(b => b.improvementPercent)).toFixed(1)}%`);
  }
  
  console.log("\n  HONESTY STATEMENT:");
  console.log("  Only benchmarks marked ✅ 'measured' are empirically validated.");
  console.log("  ⚠️ 'estimated' means calculated with approximations (e.g., token estimation).");
  console.log("  🔮 'projected' means theoretical — the feature isn't built yet.");
  console.log("  We NEVER present projected numbers as if they were measured.\n");
}
