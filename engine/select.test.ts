import { describe, expect, it } from "vitest";
import type { Exercise } from "../bank/schema.js";
import { selectExercise } from "./select.js";

function ex(id: string, tier: number, language: "python" | "javascript" = "python"): Exercise {
  return {
    id,
    kind: "write",
    axis: "syntax-recall",
    language,
    tier,
    title: id,
    prompt: "p",
    functionName: "f",
    starterCode: "s",
    softTimeLimitSeconds: 300,
    testTimeoutMs: 10_000,
    tests: [{ args: [], expected: null }],
  };
}

const outlineEx: Exercise = {
  id: "dec-any-001",
  kind: "outline",
  axis: "decomposition",
  language: "any",
  tier: 1,
  title: "outline",
  prompt: "p",
  softTimeLimitSeconds: 420,
  testTimeoutMs: 10_000,
  rubric: ["a"],
};

const bank = [ex("sr-py-001", 1), ex("sr-py-002", 2), ex("sr-py-003", 2), ex("sr-js-001", 1, "javascript"), outlineEx];

describe("selectExercise", () => {
  it("prefers the current tier", () => {
    const pick = selectExercise(bank, "syntax-recall", 2, [], undefined, () => 0);
    expect(pick?.tier).toBe(2);
  });

  it("falls back to the nearest tier when the current one is empty", () => {
    const pick = selectExercise(bank, "syntax-recall", 3, [], undefined, () => 0);
    expect(pick?.tier).toBe(2);
  });

  it("avoids recently attempted exercises when possible", () => {
    const pick = selectExercise(bank, "syntax-recall", 2, ["sr-py-002"], undefined, () => 0);
    expect(pick?.id).toBe("sr-py-003");
  });

  it("repeats rather than starving when everything is recent", () => {
    const pick = selectExercise(bank, "syntax-recall", 2, ["sr-py-002", "sr-py-003"], undefined, () => 0);
    expect(pick?.tier).toBe(2);
  });

  it("filters by language", () => {
    const pick = selectExercise(bank, "syntax-recall", 1, [], "javascript", () => 0);
    expect(pick?.id).toBe("sr-js-001");
  });

  it("language-agnostic exercises match any language filter", () => {
    const pick = selectExercise(bank, "decomposition", 1, [], "javascript", () => 0);
    expect(pick?.id).toBe("dec-any-001");
  });

  it("returns undefined for an axis with no exercises", () => {
    expect(selectExercise(bank, "debugging", 1, [])).toBeUndefined();
  });
});
