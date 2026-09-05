export const SIZE = 6;
export const HALF = 3;
export const CELLS = SIZE * SIZE;

/** 0 = sun, 1 = moon */
export type Bit = 0 | 1;
export type Cell = Bit | null;

export type ConstraintKind = "eq" | "neq";

export type Constraint = {
  a: number;
  b: number;
  kind: ConstraintKind;
};

export type Difficulty = "easy" | "medium" | "hard";

export type Puzzle = {
  id: string;
  size: typeof SIZE;
  givens: Cell[];
  constraints: Constraint[];
  solution: Bit[];
  difficulty: Difficulty;
};

export type ViolationKind = "triple" | "balance" | "constraint";

export type Violation = {
  cells: number[];
  kind: ViolationKind;
};

export type Mode = "daily" | "practice" | "archive";

export function idx(r: number, c: number): number {
  return r * SIZE + c;
}

export function rowOf(i: number): number {
  return Math.floor(i / SIZE);
}

export function colOf(i: number): number {
  return i % SIZE;
}

export function cloneCells<T>(cells: T[]): T[] {
  return cells.slice();
}
