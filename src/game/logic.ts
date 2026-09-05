import {
  CELLS,
  HALF,
  SIZE,
  type Bit,
  type Cell,
  type Constraint,
  type Violation,
  colOf,
  idx,
  rowOf,
} from "./types";

export function emptyGrid(): Cell[] {
  return Array.from({ length: CELLS }, () => null);
}

export function cycleForward(v: Cell): Cell {
  if (v === null) return 0;
  if (v === 0) return 1;
  return null;
}

export function cycleBackward(v: Cell): Cell {
  if (v === null) return 1;
  if (v === 1) return 0;
  return null;
}

function lineIndices(isRow: boolean, n: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < SIZE; k++) {
    out.push(isRow ? idx(n, k) : idx(k, n));
  }
  return out;
}

function consecutiveTriple(g: Cell[], cells: number[]): number[] | null {
  for (let i = 0; i < cells.length - 2; i++) {
    const a = cells[i]!;
    const b = cells[i + 1]!;
    const c = cells[i + 2]!;
    const va = g[a];
    if (va === null) continue;
    if (g[b] === va && g[c] === va) return [a, b, c];
  }
  return null;
}

function countBits(g: Cell[], cells: number[], bit: Bit): number {
  let n = 0;
  for (const i of cells) if (g[i] === bit) n++;
  return n;
}

function filledCount(g: Cell[], cells: number[]): number {
  let n = 0;
  for (const i of cells) if (g[i] !== null) n++;
  return n;
}

export function createsTripleAt(g: Cell[], i: number): boolean {
  const v = g[i];
  if (v === null) return false;
  const r = rowOf(i);
  const c = colOf(i);
  for (let start = Math.max(0, c - 2); start <= Math.min(c, SIZE - 3); start++) {
    if (g[idx(r, start)] === v && g[idx(r, start + 1)] === v && g[idx(r, start + 2)] === v) {
      return true;
    }
  }
  for (let start = Math.max(0, r - 2); start <= Math.min(r, SIZE - 3); start++) {
    if (g[idx(start, c)] === v && g[idx(start + 1, c)] === v && g[idx(start + 2, c)] === v) {
      return true;
    }
  }
  return false;
}

export function lineOverflowAt(g: Cell[], i: number): boolean {
  const v = g[i];
  if (v === null) return false;
  const r = rowOf(i);
  const c = colOf(i);
  if (countBits(g, lineIndices(true, r), v) > HALF) return true;
  if (countBits(g, lineIndices(false, c), v) > HALF) return true;
  return false;
}

export function findViolations(g: Cell[], constraints: Constraint[]): Violation[] {
  const out: Violation[] = [];
  const seen = new Set<string>();
  const push = (v: Violation) => {
    const key = `${v.kind}:${[...v.cells].sort((a, b) => a - b).join(",")}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(v);
  };

  for (let n = 0; n < SIZE; n++) {
    for (const isRow of [true, false]) {
      const cells = lineIndices(isRow, n);
      const triple = consecutiveTriple(g, cells);
      if (triple) push({ kind: "triple", cells: triple });
      const zeros = countBits(g, cells, 0);
      const ones = countBits(g, cells, 1);
      if (zeros > HALF || ones > HALF) {
        const bit: Bit = zeros > HALF ? 0 : 1;
        push({
          kind: "balance",
          cells: cells.filter((i) => g[i] === bit),
        });
      } else if (filledCount(g, cells) === SIZE && (zeros !== HALF || ones !== HALF)) {
        push({ kind: "balance", cells });
      }
    }
  }

  for (const c of constraints) {
    const av = g[c.a];
    const bv = g[c.b];
    if (av === null || bv === null) continue;
    const same = av === bv;
    if (c.kind === "eq" && !same) push({ kind: "constraint", cells: [c.a, c.b] });
    if (c.kind === "neq" && same) push({ kind: "constraint", cells: [c.a, c.b] });
  }

  return out;
}

export function violationSet(violations: Violation[]): Set<number> {
  const s = new Set<number>();
  for (const v of violations) for (const i of v.cells) s.add(i);
  return s;
}

export function isComplete(g: Cell[]): boolean {
  return g.every((c) => c !== null);
}

export function isSolved(g: Cell[], constraints: Constraint[]): boolean {
  return isComplete(g) && findViolations(g, constraints).length === 0;
}

export function isGiven(givens: Cell[], i: number): boolean {
  return givens[i] !== null;
}

/** Local legality of placing `v` at `i` (does not search). */
export function canPlace(g: Cell[], constraints: Constraint[], i: number, v: Bit): boolean {
  if (g[i] !== null && g[i] !== v) return false;
  const next = g.slice();
  next[i] = v;
  if (createsTripleAt(next, i) || lineOverflowAt(next, i)) return false;
  for (const c of constraints) {
    if (c.a !== i && c.b !== i) continue;
    const other = c.a === i ? c.b : c.a;
    const ov = next[other];
    if (ov === null) continue;
    if (c.kind === "eq" && ov !== v) return false;
    if (c.kind === "neq" && ov === v) return false;
  }
  return true;
}

export type HintReason =
  | "equals"
  | "cross"
  | "pair"
  | "sandwich"
  | "balance"
  | "solution";

export type Hint = {
  index: number;
  value: Bit;
  reason: HintReason;
};

function neighborsOf(i: number): number[] {
  const r = rowOf(i);
  const c = colOf(i);
  const n: number[] = [];
  if (c > 0) n.push(idx(r, c - 1));
  if (c < SIZE - 1) n.push(idx(r, c + 1));
  if (r > 0) n.push(idx(r - 1, c));
  if (r < SIZE - 1) n.push(idx(r + 1, c));
  return n;
}

function areAdjacent(a: number, b: number): boolean {
  const ra = rowOf(a);
  const ca = colOf(a);
  const rb = rowOf(b);
  const cb = colOf(b);
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}

/** A cell the player can deduce without search, else the next solution cell. */
export function findHint(g: Cell[], constraints: Constraint[], solution: Bit[]): Hint | null {
  const empty: number[] = [];
  for (let i = 0; i < CELLS; i++) if (g[i] === null) empty.push(i);
  if (empty.length === 0) return null;

  const reasonFor = (i: number, v: Bit): HintReason | null => {
    for (const c of constraints) {
      const other = c.a === i ? c.b : c.b === i ? c.a : -1;
      if (other < 0) continue;
      const ov = g[other];
      if (ov === null) continue;
      const need: Bit = c.kind === "eq" ? ov : ((1 - ov) as Bit);
      if (need === v) return c.kind === "eq" ? "equals" : "cross";
    }

    const r = rowOf(i);
    const c = colOf(i);
    for (const [dr, dc] of [
      [0, 1],
      [1, 0],
    ] as const) {
      const a = idx(r - dr, c - dc);
      const b = idx(r + dr, c + dc);
      if (a < 0 || b >= CELLS) continue;
      if (rowOf(a) !== r - dr || colOf(a) !== c - dc) continue;
      if (rowOf(b) !== r + dr || colOf(b) !== c + dc) continue;
      if (g[a] !== null && g[a] === g[b] && v === ((1 - g[a]!) as Bit)) return "sandwich";
    }

    for (const n of neighborsOf(i)) {
      for (const n2 of neighborsOf(n)) {
        if (n2 === i || !areAdjacent(n, n2)) continue;
        if (g[n] !== null && g[n] === g[n2] && v === ((1 - g[n]!) as Bit)) return "pair";
      }
    }

    for (const isRow of [true, false]) {
      const cells = lineIndices(isRow, isRow ? r : c);
      for (const bit of [0, 1] as Bit[]) {
        if (countBits(g, cells, bit) === HALF && v === ((1 - bit) as Bit)) return "balance";
      }
    }
    return null;
  };

  for (const i of empty) {
    const v = solution[i]!;
    const reason = reasonFor(i, v);
    if (reason) return { index: i, value: v, reason };
  }

  const i = empty[0]!;
  return { index: i, value: solution[i]!, reason: "solution" };
}

export function hintCopy(hint: Hint): string {
  switch (hint.reason) {
    case "equals":
      return "The equals mark requires matching tokens.";
    case "cross":
      return "The cross mark requires opposite tokens.";
    case "pair":
      return "Two identical tokens already sit together — the next must differ.";
    case "sandwich":
      return "A token between two matches must be the opposite.";
    case "balance":
      return "This line already has three of one token.";
    case "solution":
      return "This cell is forced by the unique solution.";
  }
}

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function adjacentPairs(): [number, number][] {
  const pairs: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (c + 1 < SIZE) pairs.push([idx(r, c), idx(r, c + 1)]);
      if (r + 1 < SIZE) pairs.push([idx(r, c), idx(r + 1, c)]);
    }
  }
  return pairs;
}

export function isHorizontalPair(a: number, b: number): boolean {
  return rowOf(a) === rowOf(b);
}
