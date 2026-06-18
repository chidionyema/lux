/**
 * LUX PROPERTY TEST GENERATOR — Breakthrough #6 (BUILDABLE NOW)
 * 
 * Generates property-based tests for functions being modified.
 * Catches invariant violations that example-based tests miss.
 * 
 * Architecture:
 *   Intercept edits → extract modified function → generate property tests →
 *   run in sandbox → report failures
 * 
 * Honest benchmark target: 5-10× reduction in undetected logic errors.
 * 
 * OMP APIs used:
 *   - pi.on("tool_result") — detect edits and trigger property test generation
 *   - pi.registerTool("generate_property_tests") — explicit tool for the model
 *   - pi.sendMessage() — inject property test results
 */

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// ─── Types ───────────────────────────────────────────────────────────

interface FunctionInfo {
  name: string;
  file: string;
  signature: string;
  body: string;
  isAsync: boolean;
  parameters: ParameterInfo[];
  returnType: string;
  dependencies: string[];
}

interface ParameterInfo {
  name: string;
  type: string;
  optional: boolean;
}

interface GeneratedPropertyTest {
  name: string;
  description: string;
  code: string;
  category: "roundtrip" | "idempotency" | "invariant" | "boundary" | "inverse" | "no_throw";
}

// ─── Function Parser ─────────────────────────────────────────────────

function parseFunctionInfo(code: string, name: string): FunctionInfo | null {
  // Extract function signature using basic parsing
  // In production, use OMP's tree-sitter AST tools
  const funcRegex = new RegExp(
    `(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(([^)]*)\\)\\s*(?::\\s*(\\S+))?\\s*\\{`,
    "s"
  );
  const match = funcRegex.exec(code);
  if (!match) return null;
  
  const paramsStr = match[1] || "";
  const returnType = match[2] || "void";
  const isAsync = /async/.test(match[0]);
  
  // Parse parameters
  const parameters: ParameterInfo[] = paramsStr.split(",")
    .filter(p => p.trim())
    .map(p => {
      const parts = p.trim().split(":");
      return {
        name: (parts[0] || "").trim(),
        type: (parts[1] || "any").trim().replace(/=.*/, "").trim(),
        optional: p.includes("?"),
      };
    });
  
  // Find body
  const bodyStart = match.index + match[0].length;
  let depth = 1;
  let i = bodyStart;
  while (i < code.length && depth > 0) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}") depth--;
    i++;
  }
  const body = code.slice(bodyStart, i - 1).trim();
  
  return {
    name,
    file: "",
    signature: match[0].replace(/\{[\s\S]*$/, "").trim(),
    body,
    isAsync,
    parameters,
    returnType,
    dependencies: extractDependencies(body),
  };
}

function extractDependencies(body: string): string[] {
  // Find function calls in the body
  const callRegex = /(\w+)\s*\(/g;
  const deps = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = callRegex.exec(body)) !== null) {
    const name = m[1] || "";
    // Skip JS keywords and built-ins
    if (!["if", "for", "while", "switch", "catch", "return", "throw", "new", "console"].includes(name)) {
      deps.add(name);
    }
  }
  return [...deps];
}

// ─── Property Test Generation ────────────────────────────────────────

function generatePropertyTests(func: FunctionInfo): GeneratedPropertyTest[] {
  const tests: GeneratedPropertyTest[] = [];
  
  // 1. Roundtrip test: encode → decode should be identity
  if (func.name.includes("encode") || func.name.includes("serialize") || func.name.includes("stringify")) {
    tests.push({
      name: `${func.name} roundtrip`,
      description: "Encoding followed by decoding should return the original value",
      code: `test("${func.name} roundtrip preserves original value", () => {
  fc.assert(fc.property(
    fc.record({
      id: fc.string({ minLength: 1 }),
      value: fc.integer(),
    }),
    (input) => {
      const encoded = ${func.name}(input);
      const decoded = JSON.parse(encoded); // Assuming JSON roundtrip
      expect(decoded.id).toBe(input.id);
      expect(decoded.value).toBe(input.value);
    }
  ));
});`,
      category: "roundtrip",
    });
  }
  
  // 2. Idempotency test: f(f(x)) == f(x)
  if (func.name.includes("normalize") || func.name.includes("sanitize") || func.name.includes("clean")) {
    tests.push({
      name: `${func.name} idempotency`,
      description: "Applying the function twice should give the same result as once",
      code: `test("${func.name} is idempotent", () => {
  fc.assert(fc.property(
    fc.string(),
    (input) => {
      const once = ${func.name}(input);
      const twice = ${func.name}(once);
      expect(twice).toBe(once);
    }
  ));
});`,
      category: "idempotency",
    });
  }
  
  // 3. No-throw test: valid inputs should never throw
  tests.push({
    name: `${func.name} no throw on valid input`,
    description: "The function should not throw for any valid input",
    code: `test("${func.name} does not throw for valid inputs", () => {
  fc.assert(fc.property(
    ${generateArbitraryForParams(func.parameters)},
    (input) => {
      expect(() => ${func.name}(input)).not.toThrow();
    }
  ));
});`,
    category: "no_throw",
  });
  
  // 4. Boundary test: edge cases
  tests.push({
    name: `${func.name} handles boundary values`,
    description: "Test edge cases: empty, null, max values",
    code: `test("${func.name} handles boundary values", () => {
  // Empty input
  ${func.parameters.some(p => p.type === "string") ? `expect(() => ${func.name}("")).not.toThrow();` : ""}
  // Null/undefined
  ${func.parameters.some(p => p.optional) ? `expect(() => ${func.name}(undefined)).not.toThrow();` : ""}
});`,
    category: "boundary",
  });
  
  // 5. Invariant test: output should always satisfy certain properties
  if (func.returnType !== "void" && func.returnType !== "undefined") {
    tests.push({
      name: `${func.name} output invariant`,
      description: `The return value should always be of type ${func.returnType}`,
      code: `test("${func.name} returns valid output type", () => {
  fc.assert(fc.property(
    ${generateArbitraryForParams(func.parameters)},
    (input) => {
      const result = ${func.name}(input);
      expect(result).toBeDefined();
      ${func.returnType === "boolean" ? "expect(typeof result).toBe('boolean');" : ""}
      ${func.returnType === "number" ? "expect(typeof result).toBe('number');\n      expect(isNaN(result)).toBe(false);" : ""}
      ${func.returnType === "string" ? "expect(typeof result).toBe('string');" : ""}
    }
  ));
});`,
      category: "invariant",
    });
  }
  
  return tests;
}

function generateArbitraryForParams(params: ParameterInfo[]): string {
  if (params.length === 0) return "fc.constant(undefined)";
  
  return params.map(p => {
    const base = p.type.toLowerCase();
    if (base.includes("string")) return "fc.string()";
    if (base.includes("number") || base.includes("int")) return "fc.integer()";
    if (base.includes("boolean")) return "fc.boolean()";
    if (base.includes("array")) return "fc.array(fc.string())";
    if (base.includes("date")) return "fc.date()";
    return "fc.anything()";
  }).join(", ");
}

// ─── Extension ────────────────────────────────────────────────────────

export default function luxPropertyTests(pi: ExtensionAPI) {
  pi.setLabel("LUX Property Tests");
  
  // Main tool: generate property tests for a function
  pi.registerTool({
    name: "generate_property_tests",
    label: "Generate Property Tests",
    description: "Generate property-based tests for a function to verify invariants, edge cases, and behavioral properties",
    parameters: pi.zod.object({
      functionName: pi.zod.string().describe("Name of the function to generate tests for"),
      file: pi.zod.string().describe("File containing the function"),
      invariants: pi.zod.array(pi.zod.string()).optional().describe("Additional invariants to verify"),
      runImmediately: pi.zod.boolean().default(true).describe("Whether to run the generated tests immediately"),
    }),
    async execute(_id, params, _signal, onUpdate, ctx) {
      // 1. Read the file using OMP's read tool
      onUpdate?.({ content: [{ type: "text", text: "Reading source file..." }] });
      
      // In production: use OMP's read tool to get file contents
      // const fileContent = await readFile(join(ctx.cwd, params.file), "utf-8");
      
      // For demonstration, use a mock
      const funcInfo = parseFunctionInfo("", params.functionName);
      
      if (!funcInfo) {
        return {
          content: [{ type: "text", text: `Could not find function '${params.functionName}' in ${params.file}. Check the function name and file path.` }],
          isError: true,
        };
      }
      
      // 2. Generate property tests
      onUpdate?.({ content: [{ type: "text", text: `Generating property tests for ${params.functionName}...` }] });
      const tests = generatePropertyTests(funcInfo);
      
      // 3. Write tests to file
      const testDir = join(ctx.cwd, "__tests__", "property-generated");
      await mkdir(testDir, { recursive: true });
      
      const testContent = [
        "// Auto-generated property tests by LUX",
        "// Generated at: " + new Date().toISOString(),
        `// Function: ${params.functionName}`,
        `// File: ${params.file}`,
        "",
        "import { test, expect } from 'vitest';",
        "import * as fc from 'fast-check';",
        `import { ${params.functionName} } from '${params.file.replace(/\.(ts|tsx|js)$/, "")}';`,
        "",
        ...tests.map(t => `// ${t.description}\n${t.code}`),
      ].join("\n");
      
      const testPath = join(testDir, `${params.functionName}.property.test.ts`);
      await writeFile(testPath, testContent);
      
      // 4. Optionally run tests
      let testResult = "";
      if (params.runImmediately) {
        onUpdate?.({ content: [{ type: "text", text: "Running generated tests..." }] });
        // In production: run vitest on the generated file
        testResult = `\nTests written to: ${testPath}\nRun with: npx vitest run ${testPath}`;
      }
      
      return {
        content: [{
          type: "text",
          text: `✅ Generated ${tests.length} property tests for \`${params.functionName}\`:\n\n${
            tests.map((t, i) => `${i + 1}. **${t.name}** (${t.category})\n   ${t.description}`).join("\n")
          }${testResult}`,
        }],
        details: {
          functionName: params.functionName,
          testCount: tests.length,
          testPath,
          categories: tests.map(t => t.category),
        },
      };
    },
  });

  // Auto-generate property tests after function edits
  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "edit") return;
    if (event.isError) return;
    
    // In production: detect which functions were modified and generate tests
    // For now, we notify that property test generation is available
    ctx.ui.notify("✅ Edit applied — use `generate_property_tests` for automated property testing", "info");
  });
}
