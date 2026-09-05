import { useRef } from "react";
import { cn } from "../lib/utils";
import { EqMark, MoonToken, NeqMark, SunToken } from "./icons";
import { isGiven } from "./logic";
import { SIZE, type Cell, type Constraint, type Puzzle, colOf, rowOf } from "./types";

type BoardProps = {
  puzzle: Puzzle;
  grid: Cell[];
  selected: number | null;
  errors: Set<number>;
  won: boolean;
  onCycle: (index: number, reverse: boolean) => void;
  onSelect: (index: number) => void;
};

const LONG_MS = 420;

export function Board({ puzzle, grid, selected, errors, won, onCycle, onSelect }: BoardProps) {
  const hold = useRef<{ i: number; t: number; reversed: boolean } | null>(null);

  const constraintsAt = (a: number, b: number): Constraint | undefined =>
    puzzle.constraints.find(
      (c) => (c.a === a && c.b === b) || (c.a === b && c.b === a),
    );

  return (
    <div
      className={cn("board", won && "board-won")}
      role="grid"
      aria-label="Tango puzzle"
      aria-rowcount={SIZE}
      aria-colcount={SIZE}
    >
      {Array.from({ length: SIZE }, (_, r) =>
        Array.from({ length: SIZE }, (_, c) => {
          const i = r * SIZE + c;
          const v = grid[i] ?? null;
          const given = isGiven(puzzle.givens, i);
          const err = errors.has(i);
          const on = selected === i;
          return (
            <button
              key={`c-${i}`}
              type="button"
              role="gridcell"
              aria-rowindex={r + 1}
              aria-colindex={c + 1}
              aria-label={cellLabel(r, c, v, given)}
              disabled={given || won}
              className={cn(
                "cell",
                v === 0 && "cell-sun",
                v === 1 && "cell-moon",
                given && "cell-given",
                err && "cell-error",
                on && "cell-on",
                won && "cell-won",
              )}
              style={{
                gridColumn: c * 2 + 1,
                gridRow: r * 2 + 1,
                animationDelay: won ? `${(r + c) * 40}ms` : undefined,
              }}
              onPointerDown={(e) => {
                if (given || won) return;
                onSelect(i);
                if (e.pointerType === "mouse" && e.button === 2) return;
                hold.current = { i, t: Date.now(), reversed: false };
                window.setTimeout(() => {
                  const h = hold.current;
                  if (!h || h.i !== i || h.reversed) return;
                  h.reversed = true;
                  onCycle(i, true);
                }, LONG_MS);
              }}
              onPointerUp={(e) => {
                const h = hold.current;
                hold.current = null;
                if (given || won) return;
                if (e.pointerType === "mouse" && e.button === 2) {
                  e.preventDefault();
                  onCycle(i, true);
                  return;
                }
                if (h && !h.reversed) onCycle(i, false);
              }}
              onPointerCancel={() => {
                hold.current = null;
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              {v === 0 ? <SunToken className="token" /> : null}
              {v === 1 ? <MoonToken className="token" /> : null}
            </button>
          );
        }),
      )}

      {Array.from({ length: SIZE }, (_, r) =>
        Array.from({ length: SIZE - 1 }, (_, c) => {
          const a = r * SIZE + c;
          const b = a + 1;
          const mark = constraintsAt(a, b);
          if (!mark) return null;
          return (
            <div
              key={`h-${a}`}
              className={cn("mark", mark.kind === "eq" ? "mark-eq" : "mark-neq")}
              style={{ gridColumn: c * 2 + 2, gridRow: r * 2 + 1 }}
              aria-hidden="true"
            >
              {mark.kind === "eq" ? <EqMark /> : <NeqMark />}
            </div>
          );
        }),
      )}

      {Array.from({ length: SIZE - 1 }, (_, r) =>
        Array.from({ length: SIZE }, (_, c) => {
          const a = r * SIZE + c;
          const b = a + SIZE;
          const mark = constraintsAt(a, b);
          if (!mark) return null;
          return (
            <div
              key={`v-${a}`}
              className={cn("mark", mark.kind === "eq" ? "mark-eq" : "mark-neq")}
              style={{ gridColumn: c * 2 + 1, gridRow: r * 2 + 2 }}
              aria-hidden="true"
            >
              {mark.kind === "eq" ? <EqMark /> : <NeqMark />}
            </div>
          );
        }),
      )}
    </div>
  );
}

function cellLabel(r: number, c: number, v: Cell, given: boolean): string {
  const who = v === 0 ? "sun" : v === 1 ? "moon" : "empty";
  const lock = given ? ", given" : "";
  return `Row ${r + 1}, column ${c + 1}, ${who}${lock}`;
}

export function focusNeighbor(current: number, key: string): number {
  const r = rowOf(current);
  const c = colOf(current);
  if (key === "ArrowLeft") return r * SIZE + Math.max(0, c - 1);
  if (key === "ArrowRight") return r * SIZE + Math.min(SIZE - 1, c + 1);
  if (key === "ArrowUp") return Math.max(0, r - 1) * SIZE + c;
  if (key === "ArrowDown") return Math.min(SIZE - 1, r + 1) * SIZE + c;
  return current;
}
