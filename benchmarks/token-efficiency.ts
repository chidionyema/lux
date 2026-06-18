/**
 * TOKEN EFFICIENCY BENCHMARK
 * 
 * Hypothesis: LUX's semantic patch approach uses significantly fewer tokens
 * than the standard full-file generation approach used by Claude Code / raw LLMs.
 * 
 * BASELINE: Model outputs entire modified files (standard LLM approach)
 * LUX: Model outputs only targeted patches using AST node references
 * 
 * This benchmark measures the token count difference using real codebases.
 */

import {
  BenchmarkResult,
  estimateTokens,
  measureWithSamples,
  collectFiles,
  runSuite,
  printSummary,
} from "./framework.ts";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Fixture: Real Code Samples ────────────────────────────────────────

/**
 * Representative code modifications we benchmark.
 * Each fixture: { fileName, originalCode, modifiedCode, taskDescription }
 */
interface CodeFixture {
  name: string;
  description: string;
  originalFile: string;
  modifiedFunction: string;  // The actual changed function
  fileSize: number;          // bytes
  functionSize: number;      // bytes of modified function
}

// These are representative fixtures. In production, these would be
// pulled from real git diffs in open-source projects.

const FIXTURES: CodeFixture[] = [
  {
    name: "small-function-patch",
    description: "Fix null check in a small utility function",
    originalFile: `// src/utils/validators.ts (350 lines total)
import { z } from "zod";
import { prisma } from "../db";
import { logger } from "../logger";

export const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(["user", "admin", "moderator"]),
});

export async function validateAndCreateUser(
  input: unknown
): Promise<{ id: string; email: string }> {
  const parsed = userSchema.parse(input);
  
  // Check for existing user
  const existing = await prisma.user.findUnique({
    where: { email: parsed.email },
  });
  
  if (existing) {
    throw new Error("User with this email already exists");
  }
  
  const user = await prisma.user.create({
    data: {
      email: parsed.email,
      name: parsed.name,
      role: parsed.role,
    },
  });
  
  logger.info("User created", { userId: user.id });
  
  return { id: user.id, email: user.email };
}

export function validateEmail(email: string): boolean {
  // BUG: Missing null/undefined check
  return email.includes("@") && email.includes(".");
}

// ... 300 more lines of validation functions
export function validatePassword(pw: string): boolean { /* ... */ }
export function validateUsername(un: string): boolean { /* ... */ }
// etc.`,
    modifiedFunction: `export function validateEmail(email: string): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }
  return email.includes("@") && email.includes(".");
}`,
    fileSize: 350,
    functionSize: 5,
  },
  {
    name: "medium-refactor",
    description: "Refactor payment processing to async",
    originalFile: `// src/payment/processor.ts (500 lines total)
import Stripe from "stripe";
import { prisma } from "../db";
import { sendReceipt } from "../email";
import { auditLog } from "../audit";
import { metrics } from "../metrics";
import type { Cart, PaymentMethod, PaymentResult } from "./types";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// ... 30 lines of type definitions

export async function processPayment(
  cart: Cart,
  method: PaymentMethod,
  customerId: string
): Promise<PaymentResult> {
  const startTime = Date.now();
  
  try {
    // Validate cart
    if (!cart.items || cart.items.length === 0) {
      throw new Error("Cart is empty");
    }
    
    // Calculate total
    const total = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    
    // Apply discounts
    const discount = await calculateDiscount(customerId, total);
    const finalAmount = total - discount;
    
    // Charge payment
    const charge = await stripe.charges.create({
      amount: Math.round(finalAmount * 100),
      currency: "usd",
      source: method.token,
      description: \`Payment for order from \${customerId}\`,
    });
    
    // Record transaction
    const transaction = await prisma.transaction.create({
      data: {
        customerId,
        amount: finalAmount,
        stripeChargeId: charge.id,
        status: charge.status,
        items: cart.items,
      },
    });
    
    // Send receipt
    await sendReceipt(customerId, transaction.id, finalAmount);
    
    // Audit log (SYNC - blocks response!)
    await auditLog.record("payment_processed", {
      customerId,
      amount: finalAmount,
      transactionId: transaction.id,
    });
    
    // Record metrics (SYNC - blocks response!)
    metrics.increment("payments.processed");
    
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      transactionId: transaction.id,
      amount: finalAmount,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      duration,
    };
  }
}

// ... 400 more lines: calculateDiscount, validatePaymentMethod, etc.
async function calculateDiscount(customerId: string, total: number): Promise<number> {
  // 50 lines of discount logic
  return 0;
}`,
    modifiedFunction: `export async function processPayment(
  cart: Cart,
  method: PaymentMethod,
  customerId: string
): Promise<PaymentResult> {
  const startTime = Date.now();
  
  try {
    if (!cart.items || cart.items.length === 0) {
      throw new Error("Cart is empty");
    }
    
    const total = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    
    const [discount] = await Promise.all([
      calculateDiscount(customerId, total),
    ]);
    const finalAmount = total - discount;
    
    const charge = await stripe.charges.create({
      amount: Math.round(finalAmount * 100),
      currency: "usd",
      source: method.token,
      description: \`Payment for order from \${customerId}\`,
    });
    
    const transaction = await prisma.transaction.create({
      data: {
        customerId,
        amount: finalAmount,
        stripeChargeId: charge.id,
        status: charge.status,
        items: cart.items,
      },
    });
    
    // Fire-and-forget non-critical operations (async, don't block response)
    void Promise.allSettled([
      sendReceipt(customerId, transaction.id, finalAmount),
      auditLog.record("payment_processed", {
        customerId,
        amount: finalAmount,
        transactionId: transaction.id,
      }),
      metrics.increment("payments.processed"),
    ]);
    
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      transactionId: transaction.id,
      amount: finalAmount,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      duration,
    };
  }
}`,
    fileSize: 500,
    functionSize: 80,
  },
  {
    name: "large-cross-file-refactor",
    description: "Rename a core type used across 12 files",
    originalFile: `// src/models/user.ts (200 lines)
// This type is imported by 12 other files across the codebase

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  joinedAt: Date;
  settings: UserProfileSettings;
}

export interface UserProfileSettings {
  theme: "light" | "dark" | "system";
  notifications: NotificationPreferences;
  privacy: PrivacySettings;
}

// ... 180 more lines: NotificationPreferences, PrivacySettings, etc.`,
    modifiedFunction: `export interface User {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  joinedAt: Date;
  settings: UserSettings;
}`,
    fileSize: 200,
    functionSize: 8,
  },
];

// ─── Benchmark: Token Count Comparison ─────────────────────────────────

async function benchmarkFixture(fixture: CodeFixture): Promise<BenchmarkResult> {
  // BASELINE: Full-file generation approach
  // The model would need to output the ENTIRE modified file
  // (Claude Code / raw LLM approach)
  const baselineTokens = estimateTokens(fixture.originalFile);
  
  // LUX: Semantic patch approach
  // Model outputs only: target reference + new code
  const patchFormat = `
<edit target="${fixture.name}" action="replace_body">
${fixture.modifiedFunction}
</edit>`;
  
  const patchTokens = estimateTokens(patchFormat);
  
  // Also account for the graph lookup overhead (negligible but honest)
  const graphOverhead = estimateTokens(
    `[LUX: target resolved to src/utils/validators.ts::validateEmail]`
  );
  
  const luxTokens = patchTokens + graphOverhead;
  
  const improvement = baselineTokens - luxTokens;
  const improvementPercent = ((baselineTokens - luxTokens) / baselineTokens) * 100;
  
  return {
    name: fixture.name,
    description: fixture.description,
    hypothesis: "Semantic patches use fewer tokens than full-file generation",
    baseline: {
      metric: "tokens_per_edit",
      value: baselineTokens,
      unit: "tokens",
      samples: 1,
      stddev: null,
      min: null,
      max: null,
    },
    lux: {
      metric: "tokens_per_edit",
      value: luxTokens,
      unit: "tokens",
      samples: 1,
      stddev: null,
      min: null,
      max: null,
    },
    improvement,
    improvementPercent,
    confidence: "estimated",
    timestamp: new Date().toISOString(),
    notes: `File: ${fixture.fileSize} lines. Function: ${fixture.functionSize} lines. ` +
           `Token estimation uses BPE approximation (~4 chars/token). ` +
           `Real-world savings may vary: this assumes the model can generate ` +
           `perfect semantic patches. In practice, we need to account for ` +
           `misgenerations and retries (measured in accuracy benchmark).`,
  };
}

// ─── Main Benchmark ────────────────────────────────────────────────────

export async function runTokenEfficiencyBenchmark() {
  const benchmarks: BenchmarkResult[] = [];
  
  for (const fixture of FIXTURES) {
    const result = await benchmarkFixture(fixture);
    benchmarks.push(result);
  }
  
  // Also benchmark against real code files if available
  // Try to find real projects in the user's workspace
  try {
    const realFiles = await collectFiles(
      join(__dirname, "..", "..", "ecommerce-clean", "src"),
      [".ts", ".tsx"]
    );
    
    if (realFiles.length > 0) {
      // Sample the 5 largest files
      const samples = realFiles
        .sort((a, b) => b.content.length - a.content.length)
        .slice(0, 5);
      
      for (const file of samples) {
        const baselineTokens = estimateTokens(file.content);
        // Estimate: a targeted edit affects ~15% of a file on average
        const estimatedPatchSize = Math.round(file.content.length * 0.15);
        const luxTokens = estimateTokens(
          `<edit target="${file.path}::someFunction">\n${" ".repeat(estimatedPatchSize)}\n</edit>`
        );
        
        benchmarks.push({
          name: `real-file-${file.path.split("/").pop()}`,
          description: `Token comparison for real file: ${file.path}`,
          hypothesis: "Semantic patches save tokens on real code",
          baseline: {
            metric: "tokens_per_edit",
            value: baselineTokens,
            unit: "tokens",
            samples: 1,
            stddev: null,
            min: null,
            max: null,
          },
          lux: {
            metric: "tokens_per_edit",
            value: luxTokens,
            unit: "tokens",
            samples: 1,
            stddev: null,
            min: null,
            max: null,
          },
          improvement: baselineTokens - luxTokens,
          improvementPercent: ((baselineTokens - luxTokens) / baselineTokens) * 100,
          confidence: "estimated",
          timestamp: new Date().toISOString(),
          notes: `Real file: ${file.path} (${file.content.length} bytes). Patch estimate: 15% of file.`,
        });
      }
    }
  } catch {
    // Real files not available — that's fine, we use fixtures
  }
  
  return { name: "token-efficiency", benchmarks };
}

// ─── Run if executed directly ──────────────────────────────────────────

if (import.meta.main) {
  const result = await runTokenEfficiencyBenchmark();
  await runSuite(result.name, [async () => {
    // Aggregate all benchmarks into a summary
    const avgImprovement = result.benchmarks.reduce(
      (s, b) => s + b.improvementPercent, 0
    ) / result.benchmarks.length;
    
    return {
      name: "token-efficiency-summary",
      description: "Average token savings across all fixtures",
      hypothesis: "LUX semantic patches use fewer tokens than full-file generation",
      baseline: {
        metric: "avg_tokens_per_edit",
        value: result.benchmarks.reduce((s, b) => s + b.baseline.value, 0) / 
               result.benchmarks.length,
        unit: "tokens",
        samples: result.benchmarks.length,
        stddev: null,
        min: null,
        max: null,
      },
      lux: {
        metric: "avg_tokens_per_edit",
        value: result.benchmarks.reduce((s, b) => s + b.lux.value, 0) / 
               result.benchmarks.length,
        unit: "tokens",
        samples: result.benchmarks.length,
        stddev: null,
        min: null,
        max: null,
      },
      improvement: avgImprovement,
      improvementPercent: avgImprovement,
      confidence: "estimated",
      timestamp: new Date().toISOString(),
      notes: "Average across all fixture types. Real API validation needed for production numbers.",
    };
  }]);
  
  printSummary([await runSuite(result.name, result.benchmarks.map(b => async () => b))]);
}
