import type { ExerciseGenerator } from "../bank/generators/types.js";
import type { Axis, Exercise, Language } from "../bank/schema.js";
import { hexSeed, type Rng } from "./rng.js";
import { expectedScore } from "./scoring.js";

/**
 * Information-optimal difficulty: prefer the tier where the predicted success
 * chance is nearest ~65% — hard enough to move the rating, kind enough to be
 * winnable. (A comfortable 90%-win drill teaches the Elo almost nothing.)
 */
export const TARGET_SUCCESS = 0.65;

export function targetTier(rating: number): number {
  let best = 1;
  let bestD = Infinity;
  for (const t of [1, 2, 3]) {
    const d = Math.abs(expectedScore(rating, t) - TARGET_SUCCESS);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

/** Generated ids end in "-<6 hex>": strip the seed to get the family. */
export function familyOf(exerciseId: string): string {
  const m = /^(.+)-[0-9a-f]{6}$/.exec(exerciseId);
  return m ? m[1]! : exerciseId;
}

/** A generator family offers many variants, so it outweighs one static file. */
const GENERATOR_WEIGHT = 2;

export interface SelectOptions {
  statics: Exercise[];
  generators?: ExerciseGenerator[];
  axis: Axis;
  /** Current axis rating — drives tier targeting. */
  rating: number;
  /** Recently attempted exercise ids; their families are avoided when possible. */
  recentIds?: string[];
  language?: Language;
  random?: Rng;
}

/**
 * Pick the next exercise: target the most informative tier, mix generator
 * variants with the static bank, and avoid recently-seen families so drills
 * rotate instead of repeating.
 */
export function selectExercise(opts: SelectOptions): Exercise | undefined {
  const {
    statics,
    generators = [],
    axis,
    rating,
    recentIds = [],
    language,
    random = Math.random,
  } = opts;
  const recentFamilies = new Set(recentIds.map(familyOf));
  const matchesLang = (l: Language | "any") =>
    language === undefined || l === language || l === "any";

  const target = targetTier(rating);
  const tierOrder = [1, 2, 3].sort(
    (a, b) => Math.abs(a - target) - Math.abs(b - target) || b - a,
  );

  for (const tier of tierOrder) {
    const staticPool = statics.filter(
      (e) => e.axis === axis && e.tier === tier && matchesLang(e.language),
    );
    const genPool = generators.filter(
      (g) => g.axis === axis && g.tiers.includes(tier) && matchesLang(g.language),
    );
    const freshStatics = staticPool.filter((e) => !recentFamilies.has(familyOf(e.id)));
    const freshGens = genPool.filter((g) => !recentFamilies.has(g.family));
    const anyFresh = freshStatics.length > 0 || freshGens.length > 0;
    const useStatics = anyFresh ? freshStatics : staticPool;
    const useGens = anyFresh ? freshGens : genPool;

    const total = useStatics.length + useGens.length * GENERATOR_WEIGHT;
    if (total === 0) continue;

    let roll = random() * total;
    for (const ex of useStatics) {
      roll -= 1;
      if (roll < 0) return ex;
    }
    for (const g of useGens) {
      roll -= GENERATOR_WEIGHT;
      if (roll < 0) return g.generate(hexSeed(random), tier);
    }
    // floating-point edge: fall through to the last candidate
    if (useGens.length > 0) return useGens[useGens.length - 1]!.generate(hexSeed(random), tier);
    return useStatics[useStatics.length - 1];
  }
  return undefined;
}
