import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { puzzleForDaily } from "../../src/game/generate.ts";
import {
  cycleBackward,
  cycleForward,
  emptyGrid,
  findViolations,
  formatTime,
  isSolved,
} from "../../src/game/logic.ts";
import {
  loadSave,
  recordBestTime,
  recordDailyWin,
  writeSave,
  type SaveState,
} from "../../src/game/save.ts";
import type { Cell, Constraint } from "../../src/game/types.ts";
import { VERSION, VERSION_LABEL } from "../../src/version.ts";
import type { CaseFile, Expectation, Step } from "./types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const mem = new Map<string, string>();

function ensureLocalStorage(): void {
  if (typeof (globalThis as { localStorage?: Storage }).localStorage?.getItem === "function") return;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, String(v));
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
      clear: () => mem.clear(),
      key: (i: number) => [...mem.keys()][i] ?? null,
      get length() {
        return mem.size;
      },
    },
  });
}

function blankSave(overrides: Partial<SaveState> = {}): SaveState {
  return {
    version: 1,
    muted: false,
    seenHowTo: false,
    streak: 0,
    bestStreak: 0,
    lastDailyWon: null,
    gamesWon: 0,
    bestTimeMs: null,
    daily: null,
    practiceDifficulty: "medium",
    ...overrides,
  };
}

type Ctx = {
  save: SaveState;
  grid: Cell[];
  constraints: Constraint[];
};

function applyExpect(ctx: Ctx, exp: Expectation, caseId: string): void {
  const tag = `${caseId}/${exp.assert}`;
  switch (exp.assert) {
    case "cycleForward": {
      const rows = exp.rows as Array<[Cell, Cell]>;
      for (const [from, to] of rows) {
        assert.equal(cycleForward(from), to, `${tag} ${String(from)} → ${String(to)}`);
      }
      return;
    }
    case "cycleBackward": {
      const rows = exp.rows as Array<[Cell, Cell]>;
      for (const [from, to] of rows) {
        assert.equal(cycleBackward(from), to, `${tag} ${String(from)} → ${String(to)}`);
      }
      return;
    }
    case "violationKinds": {
      const kinds = findViolations(ctx.grid, ctx.constraints).map((v) => v.kind);
      const expected = exp.kinds as string[];
      for (const kind of expected) {
        assert.ok(kinds.includes(kind), `${tag} missing ${kind} (got ${kinds.join(",")})`);
      }
      if (exp.only) assert.deepEqual([...new Set(kinds)].sort(), [...expected].sort(), tag);
      return;
    }
    case "solved": {
      assert.equal(isSolved(ctx.grid, ctx.constraints), Boolean(exp.value), tag);
      return;
    }
    case "formatTime": {
      assert.equal(formatTime(Number(exp.ms)), String(exp.value), tag);
      return;
    }
    case "bestTime": {
      assert.equal(ctx.save.bestTimeMs, exp.value === null ? null : Number(exp.value), tag);
      return;
    }
    case "storageBestTime": {
      const stored = loadSave();
      assert.equal(stored.bestTimeMs, exp.value === null ? null : Number(exp.value), tag);
      return;
    }
    case "streak": {
      assert.equal(ctx.save.streak, Number(exp.value), tag);
      return;
    }
    case "gamesWon": {
      assert.equal(ctx.save.gamesWon, Number(exp.value), tag);
      return;
    }
    case "versionMatchesPackage": {
      const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string };
      assert.equal(VERSION, pkg.version, tag);
      assert.equal(VERSION_LABEL, `v${pkg.version}`, tag);
      return;
    }
    case "htmlHasVersionTag": {
      const html = readFileSync(join(ROOT, String(exp.file ?? "index.html")), "utf8");
      assert.match(html, new RegExp(`Tango v${VERSION.replaceAll(".", "\\.")}`), tag);
      return;
    }
    case "uiUsesVersionLabel": {
      const src = readFileSync(join(ROOT, String(exp.file ?? "src/game/Game.tsx")), "utf8");
      assert.match(src, /VERSION_LABEL/, tag);
      assert.doesNotMatch(src, /APP_VERSION|"v1\.\d+\.\d+"/, tag);
      return;
    }
    default:
      throw new Error(`${tag}: unknown unit assert "${exp.assert}"`);
  }
}

function runStep(ctx: Ctx, step: Step, c: CaseFile): void {
  const tag = `${c.id}/${step.op}`;
  switch (step.op) {
    case "nop":
    case "readVersionSources":
    case "cycleTable":
      return;
    case "expect":
      applyExpect(ctx, step as unknown as Expectation, c.id);
      return;
    case "resetStorage":
      ensureLocalStorage();
      localStorage.clear();
      mem.clear();
      ctx.save = blankSave();
      return;
    case "writeBest":
      ensureLocalStorage();
      if (step.reset !== false) {
        localStorage.clear();
        mem.clear();
      }
      ctx.save = blankSave({ bestTimeMs: Number(step.value) });
      writeSave(ctx.save);
      return;
    case "recordBest":
      ctx.save = recordBestTime(ctx.save, Number(step.timeMs));
      writeSave(ctx.save);
      return;
    case "recordDailyWin":
      ctx.save = recordDailyWin(ctx.save, String(step.dateKey), Number(step.timeMs), Boolean(step.usedHint));
      writeSave(ctx.save);
      return;
    case "reloadSave":
      ctx.save = loadSave();
      return;
    case "emptyGrid":
      ctx.grid = emptyGrid();
      ctx.constraints = [];
      return;
    case "setCells": {
      const cells = step.cells as Array<{ i: number; v: Cell }>;
      for (const cell of cells) ctx.grid[cell.i] = cell.v;
      return;
    }
    case "setConstraints":
      ctx.constraints = step.constraints as Constraint[];
      return;
    case "loadDailySolution": {
      const puzzle = puzzleForDaily(String(step.dateKey ?? "2026-09-19"));
      ctx.grid = puzzle.solution.slice();
      ctx.constraints = puzzle.constraints;
      return;
    }
    case "loadDailyGivens": {
      const puzzle = puzzleForDaily(String(step.dateKey ?? "2026-09-19"));
      ctx.grid = puzzle.givens.slice();
      ctx.constraints = puzzle.constraints;
      return;
    }
    default:
      throw new Error(`${tag}: unknown unit op "${step.op}"`);
  }
}

export function runUnitCase(c: CaseFile): void {
  ensureLocalStorage();
  mem.clear();
  localStorage.clear();
  const ctx: Ctx = { save: blankSave(), grid: emptyGrid(), constraints: [] };
  for (const step of c.steps) runStep(ctx, step, c);
  for (const exp of c.expect) applyExpect(ctx, exp, c.id);
}
