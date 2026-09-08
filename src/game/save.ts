import type { Cell, Difficulty, Mode } from "./types";

const KEY = "playadda-tango-v1";
const SAVE_VERSION = 1;

export type DailyProgress = {
  dateKey: string;
  grid: Cell[];
  elapsedMs: number;
  won: boolean;
  usedHint: boolean;
  started: boolean;
};

export type SaveState = {
  version: number;
  muted: boolean;
  seenHowTo: boolean;
  streak: number;
  bestStreak: number;
  lastDailyWon: string | null;
  gamesWon: number;
  bestTimeMs: number | null;
  daily: DailyProgress | null;
  practiceDifficulty: Difficulty;
};

const defaults: SaveState = {
  version: SAVE_VERSION,
  muted: false,
  seenHowTo: false,
  streak: 0,
  bestStreak: 0,
  lastDailyWon: null,
  gamesWon: 0,
  bestTimeMs: null,
  daily: null,
  practiceDifficulty: "medium",
};

function migrate(raw: SaveState): SaveState {
  return { ...defaults, ...raw, version: SAVE_VERSION };
}

export function loadSave(): SaveState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as SaveState;
    if (!parsed || typeof parsed !== "object") return { ...defaults };
    return migrate(parsed);
  } catch {
    return { ...defaults };
  }
}

export function writeSave(state: SaveState) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, version: SAVE_VERSION }));
  } catch {
    /* private mode / quota */
  }
}

export function recordBestTime(save: SaveState, timeMs: number): SaveState {
  const t = Math.max(0, Math.round(timeMs));
  const bestTimeMs = save.bestTimeMs === null ? t : Math.min(save.bestTimeMs, t);
  return { ...save, bestTimeMs };
}

export function recordDailyWin(save: SaveState, dateKey: string, timeMs: number, _usedHint: boolean): SaveState {
  const withBest = recordBestTime(save, timeMs);
  const yesterday = adjacentDate(dateKey, -1);
  const continued = withBest.lastDailyWon === yesterday;
  const sameDay = withBest.lastDailyWon === dateKey;
  const streak = sameDay ? withBest.streak : continued ? withBest.streak + 1 : 1;
  const bestStreak = Math.max(withBest.bestStreak, streak);
  return {
    ...withBest,
    streak,
    bestStreak,
    lastDailyWon: dateKey,
    gamesWon: sameDay ? withBest.gamesWon : withBest.gamesWon + 1,
  };
}

function adjacentDate(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + delta)).toISOString().slice(0, 10);
}

export type SessionKind = { mode: Mode; dateKey?: string };
