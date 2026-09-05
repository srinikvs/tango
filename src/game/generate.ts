import { adjacentPairs, canPlace, createsTripleAt, lineOverflowAt } from "./logic";
import { hashString, mulberry32, shuffle } from "./rng";
import {
  CELLS,
  HALF,
  SIZE,
  type Bit,
  type Cell,
  type Constraint,
  type Difficulty,
  type Puzzle,
  colOf,
  idx,
  rowOf,
} from "./types";

function lineOf(isRow: boolean, n: number): number[] {
  const cells: number[] = [];
  for (let k = 0; k < SIZE; k++) cells.push(isRow ? idx(n, k) : idx(k, n));
  return cells;
}

function countBit(g: Cell[], cells: number[], bit: Bit): number {
  let n = 0;
  for (const i of cells) if (g[i] === bit) n++;
  return n;
}

function lineDuplicate(g: Cell[], isRow: boolean, n: number): boolean {
  const cells = lineOf(isRow, n);
  if (cells.some((i) => g[i] === null)) return false;
  const sig = cells.map((i) => g[i]).join("");
  for (let o = 0; o < SIZE; o++) {
    if (o === n) continue;
    const other = lineOf(isRow, o);
    if (other.some((i) => g[i] === null)) continue;
    if (other.map((i) => g[i]).join("") === sig) return true;
  }
  return false;
}

function assign(g: Cell[], i: number, v: Bit): boolean {
  if (g[i] === v) return true;
  if (g[i] !== null) return false;
  g[i] = v;
  if (createsTripleAt(g, i) || lineOverflowAt(g, i)) return false;
  if (lineDuplicate(g, true, rowOf(i))) return false;
  if (lineDuplicate(g, false, colOf(i))) return false;
  return true;
}

function applyConstraint(g: Cell[], c: Constraint): boolean {
  const av = g[c.a];
  const bv = g[c.b];
  if (c.kind === "eq") {
    if (av !== null && bv === null) return assign(g, c.b, av);
    if (bv !== null && av === null) return assign(g, c.a, bv);
    if (av !== null && bv !== null && av !== bv) return false;
  } else {
    if (av !== null && bv === null) return assign(g, c.b, (1 - av) as Bit);
    if (bv !== null && av === null) return assign(g, c.a, (1 - bv) as Bit);
    if (av !== null && bv !== null && av === bv) return false;
  }
  return true;
}

function propagateLine(g: Cell[], cells: number[]): boolean {
  const zeros = countBit(g, cells, 0);
  const ones = countBit(g, cells, 1);
  if (zeros > HALF || ones > HALF) return false;
  if (zeros === HALF) {
    for (const i of cells) if (g[i] === null && !assign(g, i, 1)) return false;
  }
  if (ones === HALF) {
    for (const i of cells) if (g[i] === null && !assign(g, i, 0)) return false;
  }

  for (let k = 0; k < SIZE - 1; k++) {
    const a = cells[k]!;
    const b = cells[k + 1]!;
    if (g[a] === null || g[a] !== g[b]) continue;
    const opp = (1 - g[a]!) as Bit;
    if (k - 1 >= 0) {
      const p = cells[k - 1]!;
      if (g[p] === null && !assign(g, p, opp)) return false;
    }
    if (k + 2 < SIZE) {
      const p = cells[k + 2]!;
      if (g[p] === null && !assign(g, p, opp)) return false;
    }
  }

  for (let k = 0; k < SIZE - 2; k++) {
    const a = cells[k]!;
    const mid = cells[k + 1]!;
    const c = cells[k + 2]!;
    if (g[a] !== null && g[a] === g[c] && g[mid] === null) {
      if (!assign(g, mid, (1 - g[a]!) as Bit)) return false;
    }
  }
  return true;
}

function filledCount(g: Cell[]): number {
  let n = 0;
  for (const v of g) if (v !== null) n++;
  return n;
}

export function propagate(g: Cell[], constraints: Constraint[]): boolean {
  let guard = 0;
  let last = -1;
  while (guard++ < 80) {
    const before = filledCount(g);
    if (before === last) return true;
    last = before;
    for (const c of constraints) {
      if (!applyConstraint(g, c)) return false;
    }
    for (let n = 0; n < SIZE; n++) {
      if (!propagateLine(g, lineOf(true, n))) return false;
      if (!propagateLine(g, lineOf(false, n))) return false;
    }
  }
  return true;
}

function legalValues(g: Cell[], constraints: Constraint[], i: number): Bit[] {
  const out: Bit[] = [];
  for (const v of [0, 1] as Bit[]) {
    if (canPlace(g, constraints, i, v)) out.push(v);
  }
  return out;
}

function pickCell(g: Cell[], constraints: Constraint[]): number {
  let best = -1;
  let bestN = 3;
  for (let i = 0; i < CELLS; i++) {
    if (g[i] !== null) continue;
    const n = legalValues(g, constraints, i).length;
    if (n < bestN) {
      best = i;
      bestN = n;
      if (n <= 1) return i;
    }
  }
  return best;
}

function restore(g: Cell[], snap: Cell[]) {
  for (let i = 0; i < CELLS; i++) g[i] = snap[i]!;
}

function countSolutions(
  start: Cell[],
  constraints: Constraint[],
  limit: number,
  rng?: () => number,
): { count: number; first: Bit[] | null } {
  const g = start.slice();
  if (!propagate(g, constraints)) return { count: 0, first: null };
  let count = 0;
  let first: Bit[] | null = null;
  let nodes = 0;
  const NODE_CAP = 40_000;

  const dfs = (): boolean => {
    if (nodes++ > NODE_CAP) return true;
    const i = pickCell(g, constraints);
    if (i < 0) {
      count++;
      if (!first) first = g.slice() as Bit[];
      return count >= limit;
    }
    let vals = legalValues(g, constraints, i);
    if (vals.length === 0) return false;
    if (rng) vals = shuffle(vals, rng);
    for (const v of vals) {
      const snap = g.slice();
      if (assign(g, i, v) && propagate(g, constraints)) {
        if (dfs()) return true;
      }
      restore(g, snap);
    }
    return false;
  };

  dfs();
  return { count, first };
}

function fillComplete(rng: () => number): Bit[] | null {
  const empty: Cell[] = Array.from({ length: CELLS }, () => null);
  const { first } = countSolutions(empty, [], 1, rng);
  return first;
}

const BUDGET: Record<Difficulty, { constraints: number; minGivens: number; maxGivens: number }> = {
  easy: { constraints: 14, minGivens: 8, maxGivens: 12 },
  medium: { constraints: 10, minGivens: 4, maxGivens: 8 },
  hard: { constraints: 8, minGivens: 2, maxGivens: 5 },
};

export function difficultyForDate(key: string): Difficulty {
  const day = new Date(`${key}T12:00:00Z`).getUTCDay();
  if (day === 1) return "easy";
  if (day === 0 || day === 6) return "hard";
  return "medium";
}

export function generatePuzzle(seed: number, difficulty: Difficulty, id: string): Puzzle | null {
  const rng = mulberry32(seed);
  const solution = fillComplete(rng);
  if (!solution) return null;

  const budget = BUDGET[difficulty];
  const pairs = shuffle(adjacentPairs(), rng);
  const constraints: Constraint[] = [];
  const degree = new Map<number, number>();
  for (const [a, b] of pairs) {
    if (constraints.length >= budget.constraints) break;
    if ((degree.get(a) ?? 0) >= 2 || (degree.get(b) ?? 0) >= 2) continue;
    if (rng() > 0.62) continue;
    constraints.push({
      a,
      b,
      kind: solution[a] === solution[b] ? "eq" : "neq",
    });
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
  }

  const givens: Cell[] = Array.from({ length: CELLS }, () => null);
  const order = shuffle(
    Array.from({ length: CELLS }, (_, i) => i),
    rng,
  );

  let { count } = countSolutions(givens, constraints, 2);
  if (count === 0) return null;

  for (const i of order) {
    if (count === 1 && givens.filter((c) => c !== null).length >= budget.minGivens) break;
    if (givens.filter((c) => c !== null).length >= budget.maxGivens && count === 1) break;
    if (givens[i] !== null) continue;
    givens[i] = solution[i]!;
    count = countSolutions(givens, constraints, 2).count;
  }

  for (const i of order) {
    if (count === 1) break;
    if (givens[i] !== null) continue;
    givens[i] = solution[i]!;
    count = countSolutions(givens, constraints, 2).count;
  }

  if (count !== 1) {
    for (let i = 0; i < CELLS; i++) givens[i] = solution[i]!;
  }

  const filled = shuffle(
    givens.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0),
    rng,
  );
  for (const i of filled) {
    const kept = givens.filter((c) => c !== null).length;
    if (kept <= budget.minGivens) break;
    const old = givens[i]!;
    givens[i] = null;
    if (countSolutions(givens, constraints, 2).count !== 1) givens[i] = old;
  }

  const check = countSolutions(givens, constraints, 2);
  if (check.count !== 1 || !check.first) return null;
  if (check.first.some((v, i) => v !== solution[i])) {
    for (let i = 0; i < CELLS; i++) solution[i] = check.first[i]!;
  }

  return {
    id,
    size: SIZE,
    givens,
    constraints,
    solution,
    difficulty,
  };
}

const cache = new Map<string, Puzzle>();

export function puzzleForDaily(dateKey: string): Puzzle {
  const cached = cache.get(`d:${dateKey}`);
  if (cached) return cached;
  const difficulty = difficultyForDate(dateKey);
  const base = hashString(`playadda-tango:${dateKey}`);
  let puzzle: Puzzle | null = null;
  for (let n = 0; n < 40; n++) {
    puzzle = generatePuzzle((base + n * 9973) >>> 0, difficulty, `daily-${dateKey}`);
    if (puzzle) break;
  }
  if (!puzzle) puzzle = fallbackPuzzle(dateKey, difficulty);
  cache.set(`d:${dateKey}`, puzzle);
  return puzzle;
}

export function puzzleForPractice(seed: number, difficulty: Difficulty): Puzzle {
  const id = `practice-${difficulty}-${seed >>> 0}`;
  const cached = cache.get(id);
  if (cached) return cached;
  let puzzle: Puzzle | null = null;
  for (let n = 0; n < 40; n++) {
    puzzle = generatePuzzle((seed + n * 7919) >>> 0, difficulty, id);
    if (puzzle) break;
  }
  if (!puzzle) puzzle = fallbackPuzzle(id, difficulty);
  cache.set(id, puzzle);
  return puzzle;
}

/** Hand-checked unique 6×6 so the game always has a board. */
function fallbackPuzzle(id: string, difficulty: Difficulty): Puzzle {
  const solution: Bit[] = [
    0, 0, 1, 0, 1, 1,
    0, 1, 0, 1, 1, 0,
    1, 0, 1, 0, 0, 1,
    1, 1, 0, 1, 0, 0,
    0, 1, 1, 0, 1, 0,
    1, 0, 0, 1, 0, 1,
  ];
  const givens: Cell[] = emptyLike(solution, [0, 5, 7, 10, 14, 17, 19, 22, 26, 31, 33]);
  const constraints: Constraint[] = [
    { a: 1, b: 2, kind: "neq" },
    { a: 3, b: 4, kind: "neq" },
    { a: 6, b: 12, kind: "neq" },
    { a: 8, b: 9, kind: "neq" },
    { a: 15, b: 16, kind: "eq" },
    { a: 18, b: 24, kind: "neq" },
    { a: 20, b: 21, kind: "neq" },
    { a: 28, b: 29, kind: "neq" },
    { a: 30, b: 31, kind: "neq" },
  ];
  return { id, size: SIZE, givens, constraints, solution, difficulty };
}

function emptyLike(solution: Bit[], keep: number[]): Cell[] {
  const g: Cell[] = Array.from({ length: CELLS }, () => null);
  for (const i of keep) g[i] = solution[i]!;
  return g;
}

export function isFallbackLegal(): boolean {
  const p = fallbackPuzzle("check", "medium");
  return countSolutions(p.givens, p.constraints, 2).count === 1;
}
