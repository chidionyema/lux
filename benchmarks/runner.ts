/**
 * LUX BENCHMARK RUNNER
 * 
 * Runs all benchmarks and produces a comprehensive report.
 * 
 * Usage:
 *   bun run bench              — run all benchmarks
 *   bun run bench --token      — token efficiency only
 *   bun run bench --latency    — latency only
 *   bun run bench --accuracy   — accuracy only
 */

import { printSummary, BenchmarkSuite } from "./framework.ts";
import { runTokenEfficiencyBenchmark } from "./token-efficiency.ts";
import { runLatencyBenchmark } from "./model-latency.ts";
import { runAccuracyBenchmark } from "./accuracy.ts";

const args = process.argv.slice(2);
const runAll = args.length === 0;
const runToken = runAll || args.includes("--token");
const runLatency = runAll || args.includes("--latency");
const runAccuracy = runAll || args.includes("--accuracy");

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  LUX BENCHMARK SUITE v0.1                                    ║");
console.log("║  Every claim in LUX is backed by a reproducible benchmark.   ║");
console.log("║  'estimated' = calculated    'projected' = theoretical       ║");
console.log("║  'measured' = empirically validated                          ║");
console.log("╚══════════════════════════════════════════════════════════════╝");

const suites: BenchmarkSuite[] = [];

if (runToken) {
  const { benchmarks } = await runTokenEfficiencyBenchmark();
  suites.push({ name: "token-efficiency", benchmarks });
}

if (runLatency) {
  const { benchmarks } = await runLatencyBenchmark();
  suites.push({ name: "latency", benchmarks });
}

if (runAccuracy) {
  const { benchmarks } = await runAccuracyBenchmark();
  suites.push({ name: "accuracy", benchmarks });
}

printSummary(suites);

// Exit with appropriate code
const hasFailures = suites.some(s =>
  s.benchmarks.some(b => b.improvement <= 0 && b.confidence === "measured")
);
process.exit(hasFailures ? 1 : 0);
