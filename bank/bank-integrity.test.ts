import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { grade, gradePrediction, solutionFileName } from "../engine/grader.js";
import { loadBank } from "./schema.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const bank = loadBank(join(here, "exercises"));

const dirs: string[] = [];
function scratch(): string {
  const d = mkdtempSync(join(tmpdir(), "atrophy-bank-"));
  dirs.push(d);
  return d;
}
afterAll(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("bank integrity", () => {
  it("every fix exercise ships a bug that actually fails at least one test", async () => {
    const fixes = bank.filter((e) => e.kind === "fix");
    expect(fixes.length).toBeGreaterThan(0);
    for (const ex of fixes) {
      const dir = scratch();
      writeFileSync(join(dir, solutionFileName(ex)), ex.starterCode, "utf8");
      const r = await grade(ex, dir);
      expect(r.passed, `${ex.id}: planted bug passes all tests - no bug to find`).toBeLessThan(r.total);
      expect(r.passed + (r.harnessError ? 0 : 1), `${ex.id}: starter should at least load`).toBeGreaterThan(0);
    }
  }, 120_000);

  it("every predict-output snippet runs cleanly and deterministically", async () => {
    const predicts = bank.filter((e) => e.kind === "predict-output");
    for (const ex of predicts) {
      const first = await gradePrediction(ex, scratch(), "");
      expect(first.error, `${ex.id}: ${first.error}`).toBeUndefined();
      expect(first.actual, `${ex.id}: snippet prints nothing`).toBeTruthy();
      const second = await gradePrediction(ex, scratch(), first.actual!);
      expect(second.correct, `${ex.id}: output is not deterministic`).toBe(true);
    }
  }, 120_000);

  it("cloze blanks actually appear in their snippets", () => {
    for (const ex of bank.filter((e) => e.kind === "cloze")) {
      expect(ex.snippet, `${ex.id}: snippet has no ____ blank`).toContain("____");
    }
  });
});
