import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HelpCircle,
  Lightbulb,
  RotateCcw,
  Undo2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Board, focusNeighbor } from "./Board";
import {
  playClear,
  playError,
  playHint,
  playPlace,
  playUndo,
  playWin,
  setMuted,
  unlockAudio,
} from "./audio";
import { puzzleForDaily, puzzleForPractice } from "./generate";
import { MoonToken, SunToken } from "./icons";
import {
  cycleBackward,
  cycleForward,
  findHint,
  findViolations,
  formatTime,
  hintCopy,
  isGiven,
  isSolved,
  violationSet,
} from "./logic";
import { hashString, puzzleNumber, utcDateKey } from "./rng";
import { loadSave, recordDailyWin, writeSave, type SaveState } from "./save";
import type { Cell, Difficulty, Mode, Puzzle } from "./types";

type Session = {
  mode: Mode;
  dateKey: string;
  puzzle: Puzzle;
  grid: Cell[];
  history: { i: number; from: Cell; to: Cell }[];
  selected: number;
  elapsedMs: number;
  running: boolean;
  won: boolean;
  usedHint: boolean;
  hintText: string | null;
};

function startSession(mode: Mode, dateKey: string, difficulty: Difficulty, restore?: Cell[]): Session {
  const puzzle =
    mode === "practice"
      ? puzzleForPractice(hashString(`p:${Date.now()}:${difficulty}`), difficulty)
      : puzzleForDaily(dateKey);
  return {
    mode,
    dateKey,
    puzzle,
    grid: restore ?? puzzle.givens.slice(),
    history: [],
    selected: 0,
    elapsedMs: 0,
    running: false,
    won: false,
    usedHint: false,
    hintText: null,
  };
}

const emptySave = (): SaveState => ({
  version: 1,
  muted: false,
  seenHowTo: true,
  streak: 0,
  bestStreak: 0,
  lastDailyWon: null,
  gamesWon: 0,
  bestTimeMs: null,
  daily: null,
  practiceDifficulty: "medium",
});

export function TangoGame() {
  const today = utcDateKey();
  const [save, setSave] = useState<SaveState>(emptySave);
  const [session, setSession] = useState<Session>(() => startSession("daily", today, "medium"));
  const [howTo, setHowTo] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const tick = useRef<number>(0);
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const stored = loadSave();
    setSave(stored);
    setMuted(stored.muted);
    if (stored.daily && stored.daily.dateKey === today) {
      setSession((s) => ({
        ...s,
        grid: stored.daily!.grid,
        elapsedMs: stored.daily!.elapsedMs,
        won: stored.daily!.won,
        usedHint: stored.daily!.usedHint,
        running: stored.daily!.started && !stored.daily!.won,
      }));
    }
    setHowTo(!stored.seenHowTo);
  }, [today]);

  useEffect(() => {
    writeSave(save);
  }, [save]);

  useEffect(() => {
    if (!session || session.mode !== "daily") return;
    const handle = window.setTimeout(() => {
      setSave((prev) => ({
        ...prev,
        daily: {
          dateKey: session.dateKey,
          grid: session.grid,
          elapsedMs: session.elapsedMs,
          won: session.won,
          usedHint: session.usedHint,
          started: session.running || session.elapsedMs > 0,
        },
      }));
    }, 400);
    return () => window.clearTimeout(handle);
  }, [session?.grid, session?.won, session?.usedHint, session?.mode, session?.dateKey]);

  useEffect(() => {
    const onHide = () => {
      setSession((s) => {
        if (!s || s.mode !== "daily") return s;
        setSave((prev) => ({
          ...prev,
          daily: {
            dateKey: s.dateKey,
            grid: s.grid,
            elapsedMs: s.elapsedMs,
            won: s.won,
            usedHint: s.usedHint,
            started: s.running || s.elapsedMs > 0,
          },
        }));
        return s;
      });
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  useEffect(() => {
    if (!session?.running || session.won) return;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setSession((s) => (s && s.running && !s.won ? { ...s, elapsedMs: s.elapsedMs + dt * 1000 } : s));
      tick.current = requestAnimationFrame(loop);
    };
    tick.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(tick.current);
  }, [session?.running, session?.won]);

  const errors = useMemo(
    () => (session ? violationSet(findViolations(session.grid, session.puzzle.constraints)) : new Set<number>()),
    [session],
  );

  const apply = useCallback((i: number, to: Cell, opts?: { hint?: boolean }) => {
    setSession((s) => {
      if (!s || s.won) return s;
      if (isGiven(s.puzzle.givens, i)) return s;
      const from = s.grid[i] ?? null;
      if (from === to) return s;
      const grid = s.grid.slice();
      grid[i] = to;
      const won = isSolved(grid, s.puzzle.constraints);
      const usedHint = s.usedHint || !!opts?.hint;
      const elapsedMs = s.elapsedMs;
      const dateKey = s.dateKey;
      const mode = s.mode;
      queueMicrotask(() => {
        if (opts?.hint) playHint();
        else if (to === null) playClear();
        else playPlace(to);
        const violations = findViolations(grid, s.puzzle.constraints);
        if (!won && violations.some((v) => v.cells.includes(i))) playError();
        if (won) {
          playWin();
          if (mode === "daily") {
            setSave((prev) => {
              const next = recordDailyWin(prev, dateKey, elapsedMs, usedHint);
              next.daily = {
                dateKey,
                grid,
                elapsedMs,
                won: true,
                usedHint,
                started: true,
              };
              return next;
            });
          }
        }
      });
      return {
        ...s,
        grid,
        history: [...s.history, { i, from, to }],
        selected: i,
        running: true,
        won,
        usedHint,
        hintText: opts?.hint ? s.hintText : null,
      };
    });
  }, []);

  const cycle = useCallback(
    (i: number, reverse: boolean) => {
      setSession((s) => {
        if (!s || s.won) return s;
        const from = s.grid[i] ?? null;
        const to = reverse ? cycleBackward(from) : cycleForward(from);
        queueMicrotask(() => apply(i, to));
        return { ...s, selected: i, running: true };
      });
    },
    [apply],
  );

  const undo = useCallback(() => {
    setSession((s) => {
      if (!s || s.won || s.history.length === 0) return s;
      const last = s.history[s.history.length - 1]!;
      const grid = s.grid.slice();
      grid[last.i] = last.from;
      playUndo();
      return { ...s, grid, history: s.history.slice(0, -1), selected: last.i };
    });
  }, []);

  const hint = useCallback(() => {
    setSession((s) => {
      if (!s || s.won) return s;
      const h = findHint(s.grid, s.puzzle.constraints, s.puzzle.solution);
      if (!h) return s;
      queueMicrotask(() => apply(h.index, h.value, { hint: true }));
      return { ...s, selected: h.index, hintText: hintCopy(h), running: true, usedHint: true };
    });
  }, [apply]);

  const resetBoard = useCallback(() => {
    setSession((s) => {
      if (!s) return s;
      return {
        ...s,
        grid: s.puzzle.givens.slice(),
        history: [],
        elapsedMs: s.mode === "daily" ? s.elapsedMs : 0,
        running: false,
        won: false,
        hintText: null,
      };
    });
    setConfirmReset(false);
  }, []);

  const playDaily = useCallback(
    (key: string) => {
      const stored = loadSave();
      const restore =
        stored.daily && stored.daily.dateKey === key ? stored.daily.grid : undefined;
      const s = startSession(key === today ? "daily" : "archive", key, "medium", restore);
      if (stored.daily && stored.daily.dateKey === key) {
        s.elapsedMs = stored.daily.elapsedMs;
        s.won = stored.daily.won;
        s.usedHint = stored.daily.usedHint;
      }
      setSession(s);
      setConfirmReset(false);
    },
    [today],
  );

  const playPractice = useCallback((difficulty: Difficulty) => {
    setSave((s) => ({ ...s, practiceDifficulty: difficulty }));
    setSession(startSession("practice", today, difficulty));
    setConfirmReset(false);
  }, [today]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!session || howTo) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "KeyZ" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        undo();
        return;
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.code)) {
        e.preventDefault();
        setSession((s) => (s ? { ...s, selected: focusNeighbor(s.selected, e.code) } : s));
        return;
      }
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        cycle(session.selected, e.shiftKey);
        return;
      }
      if (e.code === "Digit1" || e.code === "KeyS") {
        e.preventDefault();
        apply(session.selected, 0);
        return;
      }
      if (e.code === "Digit2" || e.code === "KeyM") {
        e.preventDefault();
        apply(session.selected, 1);
        return;
      }
      if (e.code === "Backspace" || e.code === "Digit0" || e.code === "Delete") {
        e.preventDefault();
        apply(session.selected, null);
        return;
      }
      if (e.code === "KeyU") {
        e.preventDefault();
        undo();
      }
      if (e.code === "KeyH") {
        e.preventDefault();
        hint();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, howTo, cycle, apply, undo, hint]);

  const title =
    session.mode === "practice"
      ? `Practice · ${session.puzzle.difficulty}`
      : `Daily · ${puzzleNumber(session.dateKey)}`;

  return (
    <div className="shell" onPointerDown={() => unlockAudio()}>
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">Playadda</p>
          <h1>Tango</h1>
        </div>
        <div className="top-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label={save.muted ? "Unmute" : "Mute"}
            onClick={() => {
              const next = !save.muted;
              setSave((s) => ({ ...s, muted: next }));
              setMuted(next);
              if (!next) unlockAudio();
            }}
          >
            {save.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="How to play"
            onClick={() => setHowTo(true)}
          >
            <HelpCircle size={18} />
          </button>
        </div>
      </header>

      <div className="meta">
        <div>
          <p className="meta-kicker">{title}</p>
          <p className="meta-sub">Harmonize the grid</p>
        </div>
        <div className="timer" aria-live="off">
          <span className="timer-label">Time</span>
          <span className="timer-value">{formatTime(session.elapsedMs)}</span>
        </div>
      </div>

      <div className="paper-wrap">
        <Board
          puzzle={session.puzzle}
          grid={session.grid}
          selected={session.selected}
          errors={errors}
          won={session.won}
          onCycle={cycle}
          onSelect={(i) => setSession((s) => (s ? { ...s, selected: i, running: true } : s))}
        />
      </div>

      <p className={cn("hint-line", session.hintText ? "on" : "")} role="status">
        {session.hintText ?? "Tap a cell to place a sun, again for a moon."}
      </p>

      <div className="toolbar">
        <button type="button" className="tool" onClick={undo} disabled={session.won || session.history.length === 0}>
          <Undo2 size={16} />
          Undo
        </button>
        <button type="button" className="tool" onClick={hint} disabled={session.won || session.grid.every((c) => c !== null)}>
          <Lightbulb size={16} />
          Hint
        </button>
        {confirmReset ? (
          <button type="button" className="tool tool-warn" onClick={resetBoard}>
            Confirm
          </button>
        ) : (
          <button
            type="button"
            className="tool"
            onClick={() => setConfirmReset(true)}
            disabled={session.grid.every((c, i) => c === session.puzzle.givens[i])}
          >
            <RotateCcw size={16} />
            Reset
          </button>
        )}
      </div>

      <div className="modes">
        <button
          type="button"
          className={cn("chip", session.mode !== "practice" && "chip-on")}
          onClick={() => playDaily(today)}
        >
          Today
        </button>
        {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
          <button
            key={d}
            type="button"
            className={cn("chip", session.mode === "practice" && session.puzzle.difficulty === d && "chip-on")}
            onClick={() => playPractice(d)}
          >
            {d[0]!.toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      <dl className="stats">
        <div>
          <dt>Streak</dt>
          <dd>{save.streak}</dd>
        </div>
        <div>
          <dt>Solved</dt>
          <dd>{save.gamesWon}</dd>
        </div>
        <div>
          <dt>Best</dt>
          <dd>{save.bestTimeMs === null ? "—" : formatTime(save.bestTimeMs)}</dd>
        </div>
      </dl>

      {session.won ? (
        <WinCard
          time={formatTime(session.elapsedMs)}
          usedHint={session.usedHint}
          mode={session.mode}
          onPractice={() => playPractice(save.practiceDifficulty)}
          onDaily={() => playDaily(today)}
        />
      ) : null}

      {howTo ? (
        <HowTo
          onClose={() => {
            setHowTo(false);
            setSave((s) => ({ ...s, seenHowTo: true }));
          }}
        />
      ) : null}

      <p className="version">v1.0.1</p>
    </div>
  );
}

function WinCard({
  time,
  usedHint,
  mode,
  onPractice,
  onDaily,
}: {
  time: string;
  usedHint: boolean;
  mode: Mode;
  onPractice: () => void;
  onDaily: () => void;
}) {
  return (
    <div className="win" role="status">
      <p className="win-kicker">Harmonized</p>
      <p className="win-time">{time}</p>
      <p className="win-note">{usedHint ? "Solved with a hint." : "Clean board — no hints."}</p>
      <div className="win-actions">
        {mode === "practice" ? (
          <button type="button" className="btn-primary" onClick={onPractice}>
            Another board
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={onPractice}>
            Practice round
          </button>
        )}
        {mode === "practice" ? (
          <button type="button" className="btn-ghost" onClick={onDaily}>
            Back to daily
          </button>
        ) : null}
      </div>
    </div>
  );
}

function HowTo({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-root" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="eyebrow">How to play</p>
        <h2 id="how-title">Fill every cell with a sun or a moon.</h2>
        <ol className="rules">
          <li>
            <span>Each row and column holds three suns and three moons.</span>
          </li>
          <li>
            <span>Never place three of the same token in a line.</span>
          </li>
          <li>
            <span>
              <b>=</b> means the two cells match. <b>×</b> means they differ.
            </span>
          </li>
          <li>
            <span>Tap to cycle empty → sun → moon. Hold or right-click to cycle back.</span>
          </li>
        </ol>
        <div className="demo-row" aria-hidden="true">
          <Mini token={0} />
          <Mini token={0} />
          <Mini token={1} good />
          <span className="demo-cap">A pair forces the opposite.</span>
        </div>
        <div className="demo-row" aria-hidden="true">
          <Mini token={0} />
          <span className="demo-eq">=</span>
          <Mini token={0} good />
          <span className="demo-cap">Equals stay in step.</span>
        </div>
        <button type="button" className="btn-primary modal-go" onClick={onClose}>
          Play
        </button>
      </div>
    </div>
  );
}

function Mini({ token, good }: { token: Cell; good?: boolean }) {
  return (
    <span className={cn("mini", good && "mini-good")}>
      {token === 0 ? <SunToken className="token" /> : null}
      {token === 1 ? <MoonToken className="token" /> : null}
    </span>
  );
}
