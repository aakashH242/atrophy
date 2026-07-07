import { describe, expect, it } from "vitest";
import { matchAssistants } from "./guard.js";

describe("matchAssistants", () => {
  it("finds known assistants by process name", () => {
    expect(
      matchAssistants(["Code.exe", "copilot-language-server.exe", "chrome.exe"]),
    ).toEqual(["GitHub Copilot"]);
    expect(matchAssistants(["Claude.exe"])).toEqual(["Claude"]);
    expect(matchAssistants(["ollama", "Cursor.exe", "windsurf"])).toEqual([
      "Cursor",
      "Ollama",
      "Windsurf",
    ]);
    expect(matchAssistants(["LM Studio.exe", "lm-studio"])).toEqual(["LM Studio"]);
  });

  it("dedupes multiple processes of the same assistant", () => {
    expect(matchAssistants(["copilot-agent", "GitHub Copilot Helper"])).toEqual([
      "GitHub Copilot",
    ]);
  });

  it("does not false-positive on ordinary software", () => {
    expect(
      matchAssistants([
        "chrome.exe",
        "discord.exe",
        "node.exe",
        "explorer.exe",
        "recursor.exe", // ^cursor anchored: must not match
        "proclaude", // ^claude anchored: must not match
        "",
      ]),
    ).toEqual([]);
  });
});
