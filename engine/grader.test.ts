import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Exercise } from "../bank/schema.js";
import { grade, solutionFileName } from "./grader.js";

const dirs: string[] = [];
function scratch(): string {
  const d = mkdtempSync(join(tmpdir(), "atrophy-test-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const pyEx: Exercise = {
  id: "sr-py-901",
  axis: "syntax-recall",
  language: "python",
  tier: 1,
  title: "double",
  prompt: "double it",
  functionName: "double",
  starterCode: "def double(x):\n    pass\n",
  softTimeLimitSeconds: 300,
  testTimeoutMs: 15_000,
  tests: [
    { args: [2], expected: 4 },
    { args: [-1], expected: -2 },
    { args: [0], expected: 0 },
  ],
};

const jsEx: Exercise = {
  ...pyEx,
  id: "sr-js-901",
  language: "javascript",
  starterCode: "function double(x) {}\nmodule.exports = { double };\n",
};

function writeSolution(dir: string, ex: Exercise, code: string): void {
  writeFileSync(join(dir, solutionFileName(ex)), code, "utf8");
}

describe("grade — python", () => {
  it("passes a correct solution", async () => {
    const dir = scratch();
    writeSolution(dir, pyEx, "def double(x):\n    return x * 2\n");
    const r = await grade(pyEx, dir);
    expect(r.harnessError).toBeUndefined();
    expect(r.passed).toBe(3);
    expect(r.total).toBe(3);
  });

  it("reports per-test failures with expected vs actual", async () => {
    const dir = scratch();
    writeSolution(dir, pyEx, "def double(x):\n    return x + 2\n");
    const r = await grade(pyEx, dir);
    expect(r.passed).toBe(1); // only x=2 works
    expect(r.failures.length).toBe(2);
    expect(r.failures[0]?.expected).toBe(-2);
    expect(r.failures[0]?.actual).toBe(1);
  });

  it("surfaces syntax errors as a load failure, not a crash", async () => {
    const dir = scratch();
    writeSolution(dir, pyEx, "def double(x)\n    return x\n");
    const r = await grade(pyEx, dir);
    expect(r.passed).toBe(0);
    expect(r.failures[0]?.index).toBe(-1);
    expect(r.failures[0]?.error).toMatch(/SyntaxError/);
  });

  it("kills infinite loops via the hard timeout", async () => {
    const dir = scratch();
    writeSolution(dir, pyEx, "def double(x):\n    while True:\n        pass\n");
    const fast = { ...pyEx, testTimeoutMs: 3000 };
    const r = await grade(fast, dir);
    expect(r.passed).toBe(0);
    expect(r.harnessError).toMatch(/timed out/);
  }, 20_000);
});

describe("grade — javascript", () => {
  it("passes a correct solution", async () => {
    const dir = scratch();
    writeSolution(dir, jsEx, "function double(x) { return x * 2; }\nmodule.exports = { double };\n");
    const r = await grade(jsEx, dir);
    expect(r.harnessError).toBeUndefined();
    expect(r.passed).toBe(3);
  });

  it("fails helpfully when the export is missing", async () => {
    const dir = scratch();
    writeSolution(dir, jsEx, "function double(x) { return x * 2; }\n");
    const r = await grade(jsEx, dir);
    expect(r.passed).toBe(0);
    expect(r.failures[0]?.error).toMatch(/not exported/);
  });

  it("compares objects with key order insensitivity", async () => {
    const dir = scratch();
    const ex: Exercise = {
      ...jsEx,
      id: "sr-js-902",
      functionName: "make",
      tests: [{ args: [], expected: { a: 1, b: 2 } }],
      starterCode: "",
    };
    writeSolution(dir, ex, "function make() { return { b: 2, a: 1 }; }\nmodule.exports = { make };\n");
    const r = await grade(ex, dir);
    expect(r.passed).toBe(1);
  });
});
