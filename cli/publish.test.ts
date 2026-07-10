import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INITIAL_RATING } from "../engine/scoring.js";
import { Store } from "../store/db.js";
import { autoSync, buildSnapshot, syncDisabled } from "./publish.js";

let dir: string;
let store: Store;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "atrophy-pub-"));
  store = new Store(join(dir, "t.db"));
});
afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("buildSnapshot", () => {
  it("averages all five axes, untested ones at the starting rating", () => {
    store.saveRating("syntax-recall", { rating: 1400, rd: 100, reps: 8 }, 2);
    const snap = buildSnapshot(store);
    expect(snap.overall).toBeCloseTo((1400 + 4 * INITIAL_RATING) / 5, 5);
    expect(snap.reps).toBe(8);
    expect(Object.keys(snap.axes)).toEqual(["syntax-recall"]);
  });

  it("cannot be inflated by hiding weak axes: more tested axes below start lower the overall", () => {
    store.saveRating("syntax-recall", { rating: 1400, rd: 100, reps: 8 }, 2);
    const before = buildSnapshot(store).overall;
    store.saveRating("debugging", { rating: 1100, rd: 100, reps: 3 }, 1);
    const after = buildSnapshot(store).overall;
    expect(after).toBeLessThan(before);
  });

  it("is all-1200 with no reps at all", () => {
    const snap = buildSnapshot(store);
    expect(snap.overall).toBe(INITIAL_RATING);
    expect(snap.reps).toBe(0);
    expect(snap.axes).toEqual({});
  });
});

describe("ATROPHY_NO_SYNC kill-switch", () => {
  afterEach(() => {
    delete process.env.ATROPHY_NO_SYNC;
    delete process.env.ATROPHY_CONFIG;
  });

  it("syncDisabled reflects the env var", () => {
    delete process.env.ATROPHY_NO_SYNC;
    expect(syncDisabled()).toBe(false);
    process.env.ATROPHY_NO_SYNC = "1";
    expect(syncDisabled()).toBe(true);
    process.env.ATROPHY_NO_SYNC = "true";
    expect(syncDisabled()).toBe(true);
    process.env.ATROPHY_NO_SYNC = "0";
    expect(syncDisabled()).toBe(false);
  });

  it("autoSync makes no network call when disabled, even while registered", async () => {
    // a fully-registered config that would otherwise POST to the board
    const cfg = join(dir, "config.json");
    writeFileSync(cfg, JSON.stringify({ leaderboard: { token: "tok", handle: "me" } }));
    process.env.ATROPHY_CONFIG = cfg;
    process.env.ATROPHY_NO_SYNC = "1";
    store.saveRating("syntax-recall", { rating: 1300, rd: 100, reps: 3 }, 2);

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await autoSync(store);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
