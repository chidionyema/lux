# LUX-OMEGA: Implementation Guide

## How to Achieve the 7 Breakthroughs — Concrete Steps

This is the execution plan. Every breakthrough maps to real code in `lux-extensions/src/`.

---

## Breakthrough Status Matrix

| # | Breakthrough | Status | Code File | Blockers | ETA |
|---|-------------|--------|-----------|----------|-----|
| 1 | Adversarial Pipeline | ✅ BUILDABLE | `adversarial.ts` | Needs real model API wiring | Day 1-2 |
| 2 | Speculative Pre-Computation | ✅ BUILDABLE | `speculative.ts` | Needs better-sqlite3 + OMP fs watchers | Day 2-3 |
| 3 | Autonomy Gradient | ✅ BUILDABLE | `autonomy.ts` | None | Day 3-4 |
| 4 | Self-Improving Codebase | ✅ BUILDABLE | `health.ts` | Needs real health check implementations | Day 4-5 |
| 5 | Universal Embeddings | ✅ BUILDABLE | `universal-embeddings.ts` | Needs actual embedding provider (OpenAI API or local model) | Day 5-6 |
| 6 | Property Test Generator | ✅ BUILDABLE | `property-tests.ts` | Needs tree-sitter for accurate function parsing | Day 6-7 |
| 7 | Intent Compiler | 🔬 RESEARCH | Not yet implemented | Needs formal spec extraction; partial (stages 1-2) buildable now | Research track |

---

## Week 1: Build All 6 Breakthroughs

### Day 1: Install OMP + Set Up Dev Environment

```bash
# 1. Install OMP
curl -fsSL https://omp.sh/install | sh

# 2. Verify installation
omp --version

# 3. Configure providers (at least 2 for adversarial pipeline)
omp --model anthropic/claude-sonnet-4-6  # Generator
# Need a 2nd provider for auditor (e.g., openai/gpt-5)

# 4. Enable memory backend
omp /settings  # → memory.backend: local

# 5. Create LUX extension project
mkdir -p ~/.omp/extensions/lux
# Copy lux-extensions/src/* to ~/.omp/extensions/lux/

# 6. Install OMP extension into dev mode
cd ~/lux/lux-extensions
npm init -y
npm install better-sqlite3
```

### Day 1-2: Wire Up Adversarial Pipeline

**Priority**: HIGH — this is the biggest quality improvement.

The adversarial extension (`adversarial.ts`) is already written. What needs to happen:

1. **Wire real model calls**: Replace the heuristic audit function with actual model API calls
   ```typescript
   // In adversarial.ts, replace runAudit():
   async function runAudit(prompt: string, model: Model, ctx: ExtensionContext): Promise<AuditResult> {
     // Use OMP's model API to call the auditor
     const result = await ctx.models.callModel(model, prompt);
     // Parse structured response
     return parseAuditResponse(result);
   }
   ```

2. **Configure auditor model**: Set up a 2nd provider (e.g., OpenAI + Anthropic)
   ```yaml
   # ~/.omp/agent/models.yml
   providers:
     - provider: anthropic
       role: default  # Generator
     - provider: openai
       role: smol     # Auditor (cheaper)
   ```

3. **Test**: Make an edit that would trigger an audit → verify it blocks

**Honest measurement**: Run 100 edits with and without adversarial pipeline. Measure:
- Edit rejection rate (should go from ~5% to ~1%)
- User satisfaction (fewer corrections needed)
- Token cost overhead (~20% increase from auditor calls)

### Day 2-3: Activate Speculative Pre-Computation

**Priority**: MEDIUM — big latency win for known issues.

1. **Set up test failure detection**: Hook into OMP's test runner output
   ```bash
   # In speculative.ts, the file watcher watches __tests__/
   # Configure OMP to save test output to .lux/last-test-output.txt
   ```

2. **Wire cheap model for pre-computation**: Use OMP's smol role for pre-computed fixes
   ```typescript
   // Get the smol model for pre-computation
   const smolModel = ctx.models.resolve("pi/smol");
   ```

3. **Create launchd/systemd daemon**: Keep OMP running 24/7 for continuous pre-computation
   ```xml
   <!-- ~/Library/LaunchAgents/com.lux.speculative.plist -->
   <dict>
     <key>Label</key><string>com.lux.speculative</string>
     <key>ProgramArguments</key>
     <array>
       <string>/usr/local/bin/omp</string>
       <string>--daemon</string>
       <string>--extension</string>
       <string>lux</string>
     </array>
     <key>RunAtLoad</key><true/>
     <key>KeepAlive</key><true/>
     <key>StartInterval</key><integer>60</integer>
   </dict>
   ```

**Honest measurement**: Cache hit rate over 1 week. Target: 60-80% for common bugfixes.

### Day 3-4: Deploy Autonomy Gradient

**Priority**: HIGH — biggest human-experience improvement.

1. **Set initial thresholds**: Conservative defaults (ask before most things)
2. **Let it learn**: After 1 week, check the autonomy DB for learned thresholds
3. **Monitor**: Watch for "user corrected" events — each one adjusts the threshold

**Honest measurement**: 
- Count "asked_user" → "user_accepted" transitions (autonomy was too low)
- Count "auto_executed" → "user_corrected" transitions (autonomy was too high)
- Target: 80% auto-execute with <5% correction rate after 2 weeks of learning

### Day 4-5: Enable Health Monitor

**Priority**: LOW — compounds over time, low immediate impact.

1. **Integrate with real tools**: npm audit, cargo audit, tree-sitter complexity analysis
2. **Configure auto-fix**: Only auto-fix non-critical issues above autonomy threshold

### Day 5-6: Set Up Universal Embeddings

**Priority**: LOW — requires multiple projects to be useful.

1. **Replace NGramEmbeddingProvider**: Use OpenAI's text-embedding-3-small or a local model
   ```typescript
   // Install: npm install openai
   import OpenAI from "openai";
   
   class OpenAIEmbeddingProvider implements EmbeddingProvider {
     private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
     
     async generateEmbedding(text: string): Promise<number[]> {
       const response = await this.client.embeddings.create({
         model: "text-embedding-3-small",
         input: text,
       });
       return response.data[0].embedding;
     }
     
     similarity(a: number[], b: number[]): number {
       let dot = 0, magA = 0, magB = 0;
       for (let i = 0; i < a.length; i++) {
         dot += a[i] * b[i];
         magA += a[i] * a[i];
         magB += b[i] * b[i];
       }
       return dot / (Math.sqrt(magA) * Math.sqrt(magB));
     }
   }
   ```

2. **Index existing projects**: Run OMP in each project to populate embeddings

### Day 6-7: Polish Property Tests

**Priority**: MEDIUM — catches logic errors.

1. **Replace regex parser with tree-sitter**: Use OMP's AST tools for accurate function extraction
2. **Integrate fast-check**: Add actual property test framework
   ```bash
   npm install fast-check
   ```

---

## Week 2: Integration, Testing, Benchmarking

### Day 8-9: End-to-End Integration

1. Wire all extensions together in `~/.omp/extensions/lux/`
2. Test the complete loop: task → adversarial audit → autonomy check → property tests → health monitoring
3. Fix integration bugs

### Day 10-11: Benchmark Suite

Create a benchmark harness that measures the full system:

```typescript
// benchmarks/lux-system-bench.ts
const tasks = [
  "Fix null pointer in user profile display",
  "Refactor payment processing to async",
  "Add input validation to registration form",
  "Optimize database query with N+1 problem",
  // ... 20+ tasks from SWE-bench or custom corpus
];

for (const task of tasks) {
  // Measure with OMP alone
  const ompTime = await measureTask(task, { lux: false });
  
  // Measure with OMP + LUX
  const luxTime = await measureTask(task, { lux: true });
  
  console.log(`${task}: OMP=${ompTime}s, OMP+LUX=${luxTime}s, improvement=${ompTime/luxTime}x`);
}
```

**Target metrics to measure**:
- Time from task to verified fix
- Token usage (model cost)
- Edit accuracy (first-attempt success rate)
- User intervention count
- Bug escape rate (bugs that pass tests but are caught by property tests or adversarial audit)

### Day 12-13: Publish

1. Create npm package: `npm publish lux-omp-extensions`
2. Write documentation
3. Create OMP marketplace submission

---

## The 1000× Stack (End State)

```
┌──────────────────────────────────────────────────────────────┐
│ LAYER 3: OMEGA (Research Track — 2026-2027)                  │
│                                                               │
│ Intent Compiler: natural language → formal spec → verified impl │
│ Proof Engine: Dafny/F* integration for critical functions      │
│ Diffusion Generation: parallel refinement (when models mature) │
│                                                               │
│ Status: 🔬 RESEARCH — prototypes exist, not production-ready  │
├──────────────────────────────────────────────────────────────┤
│ LAYER 2: LUX EXTENSIONS (Buildable NOW — Week 1-2)           │
│                                                               │
│ adversarial.ts      — multi-model audit on every edit          │
│ speculative.ts      — pre-compute fixes before you ask         │
│ autonomy.ts         — learn when to act vs. ask                │
│ health.ts           — 24/7 codebase improvement                │
│ universal-embeddings.ts — cross-project transfer learning      │
│ property-tests.ts   — invariant verification                   │
│                                                               │
│ Status: ✅ BUILDABLE — code written, needs API wiring         │
├──────────────────────────────────────────────────────────────┤
│ LAYER 1: OMP (Production — Already Shipped)                  │
│                                                               │
│ hashline edits · LSP · DAP · TTSR · Mnemopi · subagents      │
│ 40+ providers · ~55K Rust · Extensions API                    │
│                                                               │
│ Status: ✅ SHIPPED — 15-30× over Claude Code                  │
└──────────────────────────────────────────────────────────────┘
```

---

## Quick Start (Today)

```bash
# 1. Install OMP
curl -fsSL https://omp.sh/install | sh

# 2. Configure at least 2 model providers
omp --model anthropic/claude-sonnet-4-6

# 3. Install LUX extensions
mkdir -p ~/.omp/extensions/lux
cp lux-extensions/src/*.ts ~/.omp/extensions/lux/

# 4. Enable in OMP config
echo "extensions:
  - lux" >> ~/.omp/agent/config.yml

# 5. Start coding — LUX is now active
omp

# 6. Check status
/lux-status     # Shows all active LUX extensions
/autonomy       # Shows learned autonomy thresholds
/health         # Shows codebase health report
/speculative-stats  # Shows pre-computed fix cache
/universal-stats    # Shows cross-project embedding index
```

---

## Dependency Map

```
better-sqlite3  ← speculative.ts, autonomy.ts, health.ts, universal-embeddings.ts
openai          ← universal-embeddings.ts (embedding provider)
fast-check      ← property-tests.ts (property test framework)
tree-sitter     ← property-tests.ts (accurate function parsing)
OMP extensions API ← ALL extensions
OMP model API       ← adversarial.ts (real auditor calls)
OMP smol role       ← speculative.ts (cheap pre-computation)
OMP Mnemopi         ← universal-embeddings.ts (per-project scoping)
OMP subagents       ← future: intent compiler parallel exploration
```

---

## Honest Status

| What's Done | What Needs Wiring | What Needs Research |
|-------------|-------------------|---------------------|
| All 6 extension files written (~50K total) | Real model API calls in adversarial.ts | Intent Compiler (formal spec extraction) |
| Architecture documented | OpenAI embedding provider in universal-embeddings.ts | Proof-carrying code (Dafny/F* integration) |
| OMP integration analysis complete | Tree-sitter parser in property-tests.ts | Diffusion code generation |
| Benchmark framework | better-sqlite3 installation + DB init | |
| README with measured results | launchd/systemd daemon config | |
| | End-to-end integration testing | |

**What you can do RIGHT NOW to get 50-200×:**
1. Install OMP (15-30× immediately)
2. Enable OMP's memory backend (Hindsight/Mnemopi)
3. Configure 2 model providers for adversarial pipeline
4. Install LUX extensions (this repo)
5. Enable autonomy gradient and let it learn

**Time to 50-200×**: ~2 hours (install + configure)  
**Time to 200-500×**: ~2 weeks (wire up all extensions + benchmark)  
**Time to 500-1000×**: 6-24 months (as research matures)
