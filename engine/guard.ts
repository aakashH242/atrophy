import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * AI-off honor-system guard: at drill start we scan running processes for
 * known AI assistants and warn by name. Warn, never block - the plan's rule.
 * Detection failing for any reason must never get in the way of a drill.
 */

export const ASSISTANT_SIGNATURES: ReadonlyArray<{ match: RegExp; name: string }> = [
  { match: /copilot/i, name: "GitHub Copilot" },
  { match: /^claude/i, name: "Claude" },
  { match: /^cursor/i, name: "Cursor" },
  { match: /windsurf/i, name: "Windsurf" },
  { match: /codeium/i, name: "Codeium" },
  { match: /tabnine/i, name: "Tabnine" },
  { match: /^ollama/i, name: "Ollama" },
  { match: /lm[ -]?studio/i, name: "LM Studio" },
  { match: /chatgpt/i, name: "ChatGPT" },
  { match: /^aider/i, name: "Aider" },
];

/** Pure matcher, unit-testable: process names in, deduped assistant names out. */
export function matchAssistants(processNames: string[]): string[] {
  const found = new Set<string>();
  for (const raw of processNames) {
    const name = raw.trim();
    if (!name) continue;
    for (const sig of ASSISTANT_SIGNATURES) {
      if (sig.match.test(name)) found.add(sig.name);
    }
  }
  return [...found].sort();
}

async function listProcessNames(): Promise<string[]> {
  if (process.platform === "win32") {
    const { stdout } = await execFileAsync("tasklist", ["/fo", "csv", "/nh"], {
      timeout: 5000,
      windowsHide: true,
    });
    return stdout
      .split(/\r?\n/)
      .map((line) => line.split('","')[0]?.replace(/^"/, "") ?? "");
  }
  const { stdout } = await execFileAsync("ps", ["-A", "-o", "comm="], { timeout: 5000 });
  return stdout.split("\n").map((l) => l.split("/").pop() ?? l);
}

export async function detectAssistants(): Promise<string[]> {
  try {
    return matchAssistants(await listProcessNames());
  } catch {
    return []; // detection is best-effort; a drill never waits on it
  }
}
