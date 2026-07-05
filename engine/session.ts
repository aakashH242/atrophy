import { spawn } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface, type Interface } from "node:readline/promises";
import pc from "picocolors";
import {
  totalUnits,
  type ClozeExercise,
  type CodeExercise,
  type Exercise,
  type OutlineExercise,
  type PredictExercise,
} from "../bank/schema.js";
import {
  grade,
  gradeCloze,
  gradePrediction,
  solutionFileName,
  type GradeResult,
} from "./grader.js";
import { exerciseScore } from "./scoring.js";

export interface DrillOutcome {
  exercise: Exercise;
  passed: number;
  total: number;
  elapsedSeconds: number;
  score: number;
  abandoned: boolean;
}

const LOCKFILE_TEXT = `This directory is an Atrophy drill in progress.

AI OFF, honor system: no Copilot, no chat models, no AI autocomplete.
The whole point is measuring what YOU can do unaided. Search engines and
official docs are fine; generated code is not.
`;

/** Run one drill for any exercise kind. `solutionOverride` grades a
 *  pre-written answer file instead of going interactive (scripting/tests). */
export async function runDrill(
  ex: Exercise,
  solutionOverride?: string,
): Promise<DrillOutcome> {
  switch (ex.kind) {
    case "write":
    case "fix":
      return codeDrill(ex, solutionOverride);
    case "predict-output":
      return predictDrill(ex, solutionOverride);
    case "cloze":
      return clozeDrill(ex, solutionOverride);
    case "outline":
      return outlineDrill(ex, solutionOverride);
  }
}

// ---------- shared helpers ----------

function makeOutcome(
  ex: Exercise,
  passed: number,
  elapsedSeconds: number,
  abandoned = false,
): DrillOutcome {
  const total = totalUnits(ex);
  return {
    exercise: ex,
    passed: abandoned ? 0 : passed,
    total,
    elapsedSeconds,
    score: abandoned ? 0 : exerciseScore(passed, total, elapsedSeconds, ex.softTimeLimitSeconds),
    abandoned,
  };
}

function printHeader(ex: Exercise): void {
  console.log(pc.bold(`\n${ex.title}`) + pc.dim(`  [${ex.axis} · ${ex.language} · tier ${ex.tier}]`));
  console.log(pc.dim("─".repeat(60)));
  console.log(ex.prompt.trim());
  console.log(pc.dim("─".repeat(60)));
}

function printTimer(ex: Exercise): void {
  console.log(
    pc.yellow("AI off. ") +
      `Soft limit ${Math.round(ex.softTimeLimitSeconds / 60)} min — timer started.`,
  );
}

function openEditor(file: string): boolean {
  const editor =
    process.env.ATROPHY_EDITOR || process.env.VISUAL || process.env.EDITOR;
  if (!editor) return false;
  // Fire and forget: the drill timer runs while the user edits.
  const child = spawn(editor, [file], {
    stdio: "ignore",
    detached: true,
    shell: true,
  });
  child.on("error", () => {});
  child.unref();
  return true;
}

function withScratchDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "atrophy-"));
  writeFileSync(join(dir, "AI-OFF.lock"), LOCKFILE_TEXT, "utf8");
  return fn(dir).finally(() => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* temp cleanup is best-effort */
    }
  });
}

function withReadline<T>(fn: (rl: Interface) => Promise<T>): Promise<T> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return fn(rl).finally(() => rl.close());
}

/** Read a multi-line answer terminated by a lone "." line. */
async function readMultiline(rl: Interface): Promise<string> {
  const lines: string[] = [];
  for (;;) {
    const line = await rl.question("");
    if (line.trim() === ".") return lines.join("\n");
    lines.push(line);
  }
}

// ---------- write / fix (editor + hidden tests) ----------

function commentPrefix(ex: CodeExercise): string {
  return ex.language === "python" ? "#" : "//";
}

function buildSolutionFile(ex: CodeExercise): string {
  const c = commentPrefix(ex);
  const promptLines = ex.prompt
    .trim()
    .split("\n")
    .map((l) => `${c} ${l}`.trimEnd())
    .join("\n");
  const task = ex.kind === "fix" ? "Find and fix the bug below" : ex.title;
  return `${c} ${task}  [${ex.axis} / tier ${ex.tier} / ${ex.language}]
${c}
${promptLines}
${c}
${c} Soft time limit: ${Math.round(ex.softTimeLimitSeconds / 60)} min (going over shrinks the score, nothing explodes).

${ex.starterCode.trim()}
`;
}

function printFailures(result: GradeResult): void {
  if (result.harnessError) {
    console.log(pc.red("\nYour code did not run:"));
    console.log(pc.dim(result.harnessError));
    return;
  }
  for (const f of result.failures.slice(0, 3)) {
    if (f.index === -1) {
      console.log(pc.red("\nCould not load your solution:"));
      console.log(pc.dim(f.error ?? "unknown error"));
      continue;
    }
    console.log(pc.red(`\n✗ test #${f.index + 1}`) + pc.dim(`  args: ${JSON.stringify(f.args)}`));
    console.log(`  expected: ${JSON.stringify(f.expected)}`);
    if (f.error) console.log(pc.dim(`  raised:   ${f.error.split("\n").pop()}`));
    else console.log(`  got:      ${JSON.stringify(f.actual)}`);
  }
  const hidden = result.failures.length - Math.min(3, result.failures.length);
  if (hidden > 0) console.log(pc.dim(`  …and ${hidden} more failing test(s)`));
}

async function codeDrill(ex: CodeExercise, solutionOverride?: string): Promise<DrillOutcome> {
  return withScratchDir(async (dir) => {
    const file = join(dir, solutionFileName(ex));
    writeFileSync(file, buildSolutionFile(ex), "utf8");

    const started = Date.now();
    const elapsed = () => (Date.now() - started) / 1000;

    if (solutionOverride) {
      copyFileSync(solutionOverride, file);
      const result = await grade(ex, dir);
      const passed = result.harnessError ? 0 : result.passed;
      return makeOutcome(ex, passed, elapsed());
    }

    printHeader(ex);
    console.log(`Edit: ${pc.cyan(file)}`);
    if (!openEditor(file)) {
      console.log(pc.dim("(set $EDITOR / $ATROPHY_EDITOR to auto-open next time)"));
    }
    printTimer(ex);

    return withReadline(async (rl) => {
      for (;;) {
        const answer = (
          await rl.question(pc.bold("\n[Enter] submit · [q] abandon > "))
        ).trim().toLowerCase();
        if (answer === "q") return makeOutcome(ex, 0, elapsed(), true);

        const result = await grade(ex, dir);
        const passed = result.harnessError ? 0 : result.passed;
        if (passed === result.total) {
          console.log(pc.green(`\n✓ ${passed}/${result.total} tests passed`) + pc.dim(` in ${Math.round(elapsed())}s`));
          return makeOutcome(ex, passed, elapsed());
        }
        console.log(pc.red(`\n${passed}/${result.total} tests passed.`));
        printFailures(result);
        const again = (
          await rl.question(pc.bold("\n[Enter] fix & resubmit · [s] stop here · [q] abandon > "))
        ).trim().toLowerCase();
        if (again === "q") return makeOutcome(ex, 0, elapsed(), true);
        if (again === "s") return makeOutcome(ex, passed, elapsed());
      }
    });
  });
}

// ---------- predict-output (read code, type the stdout) ----------

async function predictDrill(ex: PredictExercise, solutionOverride?: string): Promise<DrillOutcome> {
  return withScratchDir(async (dir) => {
    const started = Date.now();
    const elapsed = () => (Date.now() - started) / 1000;

    if (solutionOverride) {
      const prediction = readFileSync(solutionOverride, "utf8");
      const r = await gradePrediction(ex, dir, prediction);
      return makeOutcome(ex, r.correct ? 1 : 0, elapsed());
    }

    printHeader(ex);
    console.log(ex.snippet.trimEnd());
    console.log(pc.dim("─".repeat(60)));
    printTimer(ex);
    console.log(
      pc.bold("\nType the program's exact stdout.") +
        pc.dim(" Finish with a single '.' on its own line; 'q.' alone abandons."),
    );

    return withReadline(async (rl) => {
      const prediction = await readMultiline(rl);
      if (prediction.trim().toLowerCase() === "q") return makeOutcome(ex, 0, elapsed(), true);
      const r = await gradePrediction(ex, dir, prediction);
      if (r.error) {
        console.log(pc.red(`\n${r.error}`));
        return makeOutcome(ex, 0, elapsed(), true); // bank bug — don't punish the user
      }
      if (r.correct) {
        console.log(pc.green("\n✓ exact match") + pc.dim(` in ${Math.round(elapsed())}s`));
      } else {
        console.log(pc.red("\n✗ not quite.") + " Actual output:");
        console.log(pc.dim(r.actual ?? ""));
      }
      return makeOutcome(ex, r.correct ? 1 : 0, elapsed());
    });
  });
}

// ---------- cloze (fill in the blank) ----------

async function clozeDrill(ex: ClozeExercise, solutionOverride?: string): Promise<DrillOutcome> {
  const started = Date.now();
  const elapsed = () => (Date.now() - started) / 1000;

  if (solutionOverride) {
    const answer = readFileSync(solutionOverride, "utf8").split(/\r?\n/)[0] ?? "";
    return makeOutcome(ex, gradeCloze(ex, answer) ? 1 : 0, elapsed());
  }

  printHeader(ex);
  console.log(ex.snippet.trimEnd());
  console.log(pc.dim("─".repeat(60)));
  printTimer(ex);

  return withReadline(async (rl) => {
    const answer = (await rl.question(pc.bold("\nFill the blank ____ (q to abandon) > "))).trim();
    if (answer.toLowerCase() === "q") return makeOutcome(ex, 0, elapsed(), true);
    const correct = gradeCloze(ex, answer);
    if (correct) {
      console.log(pc.green("\n✓ correct") + pc.dim(` in ${Math.round(elapsed())}s`));
    } else {
      console.log(pc.red("\n✗ nope.") + ` Accepted: ${ex.acceptedAnswers.join(" | ")}`);
    }
    return makeOutcome(ex, correct ? 1 : 0, elapsed());
  });
}

// ---------- outline (decomposition, self-scored against a rubric) ----------

function buildOutlineFile(ex: OutlineExercise): string {
  return `# ${ex.title}

${ex.prompt.trim()}

AI OFF. Write your outline below the line — pseudocode or bullets, 5–10 points.

---

-
`;
}

async function outlineDrill(ex: OutlineExercise, solutionOverride?: string): Promise<DrillOutcome> {
  if (solutionOverride) {
    throw new Error("--solution is not supported for outline drills (they are self-scored interactively)");
  }
  return withScratchDir(async (dir) => {
    const file = join(dir, solutionFileName(ex));
    writeFileSync(file, buildOutlineFile(ex), "utf8");

    const started = Date.now();
    const elapsed = () => (Date.now() - started) / 1000;

    printHeader(ex);
    console.log(`Edit: ${pc.cyan(file)}`);
    if (!openEditor(file)) {
      console.log(pc.dim("(set $EDITOR / $ATROPHY_EDITOR to auto-open next time)"));
    }
    printTimer(ex);

    return withReadline(async (rl) => {
      const answer = (
        await rl.question(pc.bold("\n[Enter] submit outline · [q] abandon > "))
      ).trim().toLowerCase();
      if (answer === "q") return makeOutcome(ex, 0, elapsed(), true);

      console.log(pc.bold("\nRubric — score yourself honestly:"));
      ex.rubric.forEach((point, i) => console.log(`  ${i + 1}. ${point}`));
      const n = ex.rubric.length;
      for (;;) {
        const raw = (
          await rl.question(pc.bold(`\nHow many of these ${n} points does your outline genuinely cover? (0-${n}) > `))
        ).trim();
        const covered = Number.parseInt(raw, 10);
        if (Number.isInteger(covered) && covered >= 0 && covered <= n) {
          return makeOutcome(ex, covered, elapsed());
        }
        console.log(pc.dim(`enter a number between 0 and ${n}`));
      }
    });
  });
}
