/**
 * LUX VERIFICATION API — HTTP Bridge for Hermes Integration
 * 
 * Fixes the clunky subprocess bridge. Hermes calls this API directly
 * instead of spawning Node.js processes for every verification.
 * 
 * Structured JSON responses. Streaming results. Test-by-test breakdown.
 * 
 * Start: npx tsx src/proof/verify-api.ts
 * Port: 4200
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SpecVerifier, type FunctionSpec } from "./spec";

const PORT = 4200;

// ─── In-memory spec store ────────────────────────────────────────────

const specStore = new Map<string, FunctionSpec>();

function loadSpecs(): void {
  const specDir = join(process.cwd(), ".lux", "specs");
  if (!existsSync(specDir)) return;
  
  // Load all JSON spec files
  // In production: scan directory, parse JSON, register specs
}

// ─── Handlers ────────────────────────────────────────────────────────

async function handleVerify(req: IncomingMessage, res: ServerResponse, body: any): Promise<void> {
  const { functionName, functionBody, edgeCases, postconditions, samples = 1000 } = body;
  
  if (!functionName || !functionBody) {
    json(res, 400, { error: "Missing functionName or functionBody" });
    return;
  }
  
  // Build spec from request
  const spec: FunctionSpec = {
    functionName,
    preconditions: [],
    postconditions: (postconditions || []).map((p: any) => ({
      name: p.name,
      description: p.description || "",
      check: new Function("input", "output", `return (${p.check})(input, output);`) as any,
      rationale: p.rationale || "",
    })),
    invariants: [],
    edgeCases: (edgeCases || []).map((e: any) => ({
      name: e.name,
      description: e.description || "",
      input: e.input,
      expectedOutput: e.expected,
    })),
  };
  
  // Create implementation from body
  let impl: Function;
  try {
    impl = new Function(`return (${functionBody})`)();
  } catch (err: any) {
    json(res, 400, { error: `Parse error: ${err.message}` });
    return;
  }
  
  // Run verification
  const verifier = new SpecVerifier();
  const result = verifier.verify(spec, impl, samples);
  
  json(res, 200, {
    functionName,
    verdict: result.verdict,
    totalClauses: result.totalClauses,
    passedClauses: result.passedClauses,
    failedClauses: result.failedClauses,
    timestamp: new Date().toISOString(),
    
    // Structured breakdown per clause
    preconditions: result.preconditionResults.map(r => ({
      name: r.name, verdict: r.verdict, duration: r.duration,
    })),
    postconditions: result.postconditionResults.map(r => ({
      name: r.name, verdict: r.verdict, counterexample: r.counterexample, duration: r.duration,
    })),
    invariants: result.invariantResults.map(r => ({
      name: r.name, verdict: r.verdict, counterexample: r.counterexample, duration: r.duration,
    })),
    edgeCases: result.edgeCaseResults.map(r => ({
      name: r.name, verdict: r.verdict, input: r.input, expected: r.expected, actual: r.actual,
    })),
  });
}

async function handleHealth(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  json(res, 200, {
    status: "ok",
    specsLoaded: specStore.size,
    uptime: process.uptime(),
  });
}

// ─── Server ───────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, data: any): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  
  const url = req.url || "/";
  
  if (url === "/health" && req.method === "GET") {
    return handleHealth(req, res);
  }
  
  if (url === "/verify" && req.method === "POST") {
    const body = await parseBody(req);
    return handleVerify(req, res, body);
  }
  
  json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`🔍 LUX Verification API on http://localhost:${PORT}`);
  console.log(`   POST /verify  — Run verification`);
  console.log(`   GET  /health  — Health check`);
  
  // Load any existing specs
  loadSpecs();
});

// ─── Hermes Python client (usage example) ─────────────────────────────
//
// import requests
// 
// def lux_verify(function_name, function_body, edge_cases):
//     resp = requests.post("http://localhost:4200/verify", json={
//         "functionName": function_name,
//         "functionBody": function_body,
//         "edgeCases": edge_cases,
//         "samples": 1000
//     })
//     return resp.json()
// 
// result = lux_verify("calculateDiscount", code, [
//     {"name": "zero", "input": 0, "expected": 0},
//     {"name": "gold", "input": 100, "expected": 10},
// ])
// print(f"Verdict: {result['verdict']}")
// print(f"Edge cases: {result['edgeCases']}")
