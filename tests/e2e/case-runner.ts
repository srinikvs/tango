import { expect, type Page } from "@playwright/test";
import type { CaseFile, Expectation, Step } from "../cases/types.ts";
import { firstEmptyCell, openFresh, readSave, waitPlay } from "./helpers.ts";

type Ctx = {
  tappedToken: string | null;
};

function ids(exp: Expectation): string[] {
  return (Array.isArray(exp.testId) ? exp.testId : [exp.testId]) as string[];
}

async function applyExpect(page: Page, ctx: Ctx, exp: Expectation, caseId: string): Promise<void> {
  const tag = `${caseId}/${exp.assert}`;
  switch (exp.assert) {
    case "visible":
      await expect(page.getByTestId(String(exp.testId)), tag).toBeVisible();
      return;
    case "count": {
      const loc = exp.selector
        ? page.getByTestId(String(exp.testId)).locator(String(exp.selector))
        : page.getByTestId(String(exp.testId));
      await expect(loc, tag).toHaveCount(Number(exp.value));
      return;
    }
    case "text": {
      await expect(page.getByTestId(String(exp.testId)), tag).toHaveText(new RegExp(String(exp.match)));
      return;
    }
    case "textEquals":
      await expect(page.getByTestId(String(exp.testId)), tag).toHaveText(String(exp.value));
      return;
    case "below": {
      const above = await page.getByTestId(String(exp.above)).boundingBox();
      const below = await page.getByTestId(String(exp.below)).boundingBox();
      expect(above && below, tag).toBeTruthy();
      expect(below!.y, tag).toBeGreaterThan(above!.y);
      return;
    }
    case "heading":
      await expect(page.getByRole("heading", { name: String(exp.name) }), tag).toBeVisible();
      return;
    case "enabled":
      await expect(page.getByTestId(String(exp.testId)), tag).toBeEnabled();
      return;
    case "bestValue":
      await expect(page.getByTestId("best-value"), tag).toHaveText(String(exp.value));
      return;
    case "viewport": {
      const vp = page.viewportSize();
      expect(vp, tag).toEqual({ width: Number(exp.width), height: Number(exp.height) });
      return;
    }
    case "inViewport":
    case "noVerticalClip": {
      const vp = page.viewportSize()!;
      for (const id of ids(exp)) {
        const box = await page.getByTestId(id).boundingBox();
        expect(box, `${tag} ${id}`).toBeTruthy();
        expect(box!.y, `${tag} ${id} top`).toBeGreaterThanOrEqual(-1);
        expect(box!.y + box!.height, `${tag} ${id} bottom`).toBeLessThanOrEqual(vp.height + 1);
        expect(box!.x, `${tag} ${id} left`).toBeGreaterThanOrEqual(-1);
        expect(box!.x + box!.width, `${tag} ${id} right`).toBeLessThanOrEqual(vp.width + 1);
      }
      return;
    }
    case "boardFullyVisible": {
      const vp = page.viewportSize()!;
      const board = await page.getByTestId("board").boundingBox();
      const hud = await page.getByTestId("hud").boundingBox();
      expect(board && hud, tag).toBeTruthy();
      expect(board!.width, `${tag} width`).toBeGreaterThan(160);
      expect(board!.height, `${tag} height`).toBeGreaterThan(160);
      expect(board!.y, `${tag} below hud`).toBeGreaterThanOrEqual((hud?.y ?? 0) - 2);
      expect(board!.y + board!.height, `${tag} bottom`).toBeLessThanOrEqual(vp.height + 1);
      expect(board!.x, `${tag} left`).toBeGreaterThanOrEqual(-1);
      expect(board!.x + board!.width, `${tag} right`).toBeLessThanOrEqual(vp.width + 1);
      return;
    }
    case "chromeAboveHomeBar": {
      const vp = page.viewportSize()!;
      const sab = Number(exp.sab ?? 0);
      const box = await page.getByTestId(String(exp.testId)).boundingBox();
      expect(box, tag).toBeTruthy();
      expect(box!.y + box!.height, tag).toBeLessThanOrEqual(vp.height - sab + 2);
      return;
    }
    case "cellsUsable": {
      const minSize = Number(exp.minSize ?? 36);
      const vp = page.viewportSize()!;
      const cells = page.locator('[data-testid^="cell-"]');
      const n = await cells.count();
      expect(n, `${tag} cell count`).toBe(36);
      const sample = [0, 5, 15, 20, 30, 35];
      for (const i of sample) {
        const box = await cells.nth(i).boundingBox();
        expect(box, `${tag} cell ${i}`).toBeTruthy();
        expect(box!.width, `${tag} cell ${i} w`).toBeGreaterThanOrEqual(minSize - 0.5);
        expect(box!.height, `${tag} cell ${i} h`).toBeGreaterThanOrEqual(minSize - 0.5);
        expect(box!.x, `${tag} cell ${i} left`).toBeGreaterThanOrEqual(-1);
        expect(box!.y, `${tag} cell ${i} top`).toBeGreaterThanOrEqual(-1);
        expect(box!.x + box!.width, `${tag} cell ${i} right`).toBeLessThanOrEqual(vp.width + 1);
        expect(box!.y + box!.height, `${tag} cell ${i} bottom`).toBeLessThanOrEqual(vp.height + 1);
      }
      return;
    }
    case "versionReadable": {
      const el = page.getByTestId("version");
      await expect(el, tag).toBeVisible();
      await expect(el, tag).toHaveText(/v1\.\d+\.\d+/);
      const box = await el.boundingBox();
      expect(box, tag).toBeTruthy();
      expect(box!.width, `${tag} width`).toBeGreaterThan(16);
      expect(box!.height, `${tag} height`).toBeGreaterThan(6);
      return;
    }
    case "bestReadable": {
      const el = page.getByTestId("best");
      await expect(el, tag).toBeVisible();
      await expect(el, tag).toHaveText(/Best/);
      const box = await el.boundingBox();
      expect(box, tag).toBeTruthy();
      expect(box!.width, `${tag} width`).toBeGreaterThan(20);
      expect(box!.height, `${tag} height`).toBeGreaterThan(10);
      return;
    }
    case "storageBestTime": {
      const save = await readSave(page);
      expect(save?.bestTimeMs, tag).toBe(Number(exp.value));
      return;
    }
    case "bestSurvivesReload": {
      const before = await readSave(page);
      expect(before?.bestTimeMs, tag).toBeGreaterThan(0);
      await page.reload();
      await expect(page.getByTestId("start")).toBeVisible();
      const chip = page.getByTestId("best-value");
      await expect(chip, tag).toHaveText(String(exp.value ?? "0:45"));
      const save = await readSave(page);
      expect(save?.bestTimeMs, tag).toBe(before?.bestTimeMs);
      return;
    }
    case "placedSunAfterTap": {
      const cell = firstEmptyCell(page);
      await expect(cell, tag).toHaveCount(1);
      await cell.click();
      await expect(cell, tag).toHaveAttribute("data-token", "sun");
      ctx.tappedToken = "sun";
      return;
    }
    default:
      throw new Error(`${tag}: unknown e2e/pixel assert "${exp.assert}"`);
  }
}

async function runStep(page: Page, ctx: Ctx, step: Step, c: CaseFile): Promise<void> {
  switch (step.op) {
    case "openFresh":
      await openFresh(page, step.bestTimeMs != null ? Number(step.bestTimeMs) : undefined);
      return;
    case "click":
      await page.getByTestId(String(step.testId)).click();
      return;
    case "waitPlay":
      await waitPlay(page);
      return;
    case "reload":
      await page.reload();
      return;
    case "emulateSafeArea": {
      const sat = Number(step.sat ?? 0);
      const sab = Number(step.sab ?? 0);
      await page.addStyleTag({
        content: `:root { --sat: ${sat}px; --sab: ${sab}px; }`,
      });
      const vp = page.viewportSize()!;
      await page.setViewportSize({ width: vp.width, height: vp.height - 1 });
      await page.setViewportSize(vp);
      return;
    }
    case "expect":
      await applyExpect(page, ctx, step as unknown as Expectation, c.id);
      return;
    default:
      throw new Error(`${c.id}: unknown e2e op "${step.op}"`);
  }
}

export async function runE2ECase(page: Page, c: CaseFile): Promise<void> {
  const ctx: Ctx = { tappedToken: null };
  for (const step of c.steps) await runStep(page, ctx, step, c);
  for (const exp of c.expect) await applyExpect(page, ctx, exp, c.id);
}
