import { expect, test, type Page } from "@playwright/test";
import { SAVE_KEY, type SaveState } from "../../src/game/save.ts";

export const LIVE_HOOKS_SKIP =
  "Live BASE_URL lacks data-testid hooks (this deploy predates the test suite). CI e2e is intended to pass on local preview — unset BASE_URL to use http://127.0.0.1:4173/tango/, or deploy a hooked build.";

function isRemoteBase(): boolean {
  return Boolean(process.env.BASE_URL?.trim());
}

function seedSave(bestTimeMs?: number): SaveState {
  return {
    version: 1,
    muted: true,
    seenHowTo: true,
    streak: 0,
    bestStreak: 0,
    lastDailyWon: null,
    gamesWon: 0,
    bestTimeMs: bestTimeMs ?? null,
    daily: null,
    practiceDifficulty: "medium",
  };
}

export async function requireHooks(page: Page): Promise<void> {
  const n = await page.locator("[data-testid='start']").count();
  if (n > 0) return;
  if (isRemoteBase()) {
    test.skip(true, LIVE_HOOKS_SKIP);
  }
  throw new Error(
    "Local preview is missing data-testid=\"start\". The suite expects hooks from this branch; do not point CI at an unhooked live build.",
  );
}

export async function openFresh(page: Page, bestTimeMs?: number): Promise<void> {
  await page.addInitScript(
    ({ SAVE_KEY, seed }) => {
      if (sessionStorage.getItem("tango-e2e-seeded")) return;
      localStorage.clear();
      localStorage.setItem(SAVE_KEY, JSON.stringify(seed));
      sessionStorage.setItem("tango-e2e-seeded", "1");
    },
    { SAVE_KEY, seed: seedSave(bestTimeMs) },
  );
  await page.goto("./");
  await requireHooks(page);
  await expect(page.getByTestId("start")).toBeVisible();
}

export async function waitPlay(page: Page): Promise<void> {
  await expect(page.getByTestId("board")).toBeVisible();
  await expect(page.getByTestId("hud")).toBeVisible();
}

export async function readSave(page: Page): Promise<SaveState | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as SaveState) : null;
  }, SAVE_KEY);
}

export function firstEmptyCell(page: Page) {
  return page.locator('[data-testid^="cell-"][data-token="empty"]:not([disabled])').first();
}
