/**
 * Spec Linter Tests
 */

import { describe, test, expect } from "vitest";
import { lintSpec, printLintIssues } from "../src/proof/spec-linter";
import type { FunctionSpec } from "../src/proof/spec";

describe("lintSpec", () => {
  test("flags preconditions that throw on undefined", () => {
    const spec: FunctionSpec<number[], number> = {
      functionName: "sum",
      preconditions: [
        {
          name: "is_array",
          description: "input is an array",
          // throws on undefined because of .length access
          check: (xs: number[]) => xs.length > 0,
          rationale: "domain",
        },
      ],
      postconditions: [],
      invariants: [],
      edgeCases: [
        { name: "empty", description: "", input: [], expectedOutput: 0 },
      ],
    };

    const issues = lintSpec(spec);
    expect(issues.length).toBeGreaterThan(0);
    const throwing = issues.find((i) => i.message.includes("throws on baseline"));
    expect(throwing).toBeDefined();
    expect(throwing?.severity).toBe("error");
  });

  test("passes a well-formed spec with no issues", () => {
    const spec: FunctionSpec<number, number> = {
      functionName: "double",
      preconditions: [
        {
          name: "is_number",
          description: "x is a number",
          check: (x) => typeof x === "number",  // safe
          rationale: "type guard",
        },
      ],
      postconditions: [
        {
          name: "is_twice",
          description: "output is 2x input",
          check: (i, o) => typeof i === "number" && o === i * 2,  // safe
          rationale: "definition",
        },
      ],
      invariants: [
        {
          name: "is_finite",
          description: "always finite",
          check: (_i, o) => typeof o === "number" && Number.isFinite(o),
          rationale: "type guard",
          arbitrary: () => Math.random() * 100,
        },
      ],
      edgeCases: [
        { name: "zero", description: "", input: 0, expectedOutput: 0 },
        { name: "negative", description: "", input: -3, expectedOutput: -6 },
        { name: "fraction", description: "", input: 1.5, expectedOutput: 3 },
      ],
    };

    const issues = lintSpec(spec);
    expect(issues).toEqual([]);
  });

  test("warns when there are no edge cases", () => {
    const spec: FunctionSpec<number, number> = {
      functionName: "double",
      preconditions: [
        { name: "is_number", description: "", check: (x) => typeof x === "number", rationale: "" },
      ],
      postconditions: [
        { name: "is_twice", description: "", check: (i, o) => o === i * 2, rationale: "" },
      ],
      invariants: [],
      edgeCases: [],
    };

    const issues = lintSpec(spec);
    const edgeCaseWarning = issues.find((i) => i.clauseType === "edgeCase");
    expect(edgeCaseWarning).toBeDefined();
    expect(edgeCaseWarning?.severity).toBe("warning");
  });

  test("flags invariants without arbitrary() generator", () => {
    const spec: FunctionSpec<number, number> = {
      functionName: "double",
      preconditions: [
        { name: "is_number", description: "", check: (x) => typeof x === "number", rationale: "" },
      ],
      postconditions: [
        { name: "is_twice", description: "", check: (i, o) => o === i * 2, rationale: "" },
      ],
      invariants: [
        {
          name: "no_arbitrary",
          description: "",
          check: (_i, o) => typeof o === "number",
          rationale: "",
          // @ts-expect-error - testing missing arbitrary
          arbitrary: undefined,
        },
      ],
      edgeCases: [
        { name: "zero", description: "", input: 0, expectedOutput: 0 },
      ],
    };

    const issues = lintSpec(spec);
    const missingArbitrary = issues.find((i) => i.message.includes("arbitrary"));
    expect(missingArbitrary).toBeDefined();
  });
});

describe("printLintIssues", () => {
  test("prints 'no issues' for empty array", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    printLintIssues([]);
    expect(spy).toHaveBeenCalledWith("✅ Spec lint: no issues found");
    spy.mockRestore();
  });
});

// Re-import vi for the spy
import { vi } from "vitest";
