export { rngFor, type ExerciseGenerator } from "./types.js";

import type { ExerciseGenerator } from "./types.js";
import { apiMemoryGenerators } from "./api-memory.js";
import { codeReadingGenerators } from "./code-reading.js";
import { debuggingGenerators } from "./debugging.js";
import { syntaxRecallGenerators } from "./syntax-recall.js";

/** Every registered exercise family. Selection mixes these with the static bank. */
export const allGenerators: ExerciseGenerator[] = [
  ...syntaxRecallGenerators,
  ...debuggingGenerators,
  ...codeReadingGenerators,
  ...apiMemoryGenerators,
];
