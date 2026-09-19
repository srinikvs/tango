import assert from "node:assert/strict";
import { test } from "node:test";
import { assertCatalog, casesForPlaywrightProject, loadCases } from "../../tests/cases/load.ts";
import { runUnitCase } from "../../tests/cases/unit-runner.ts";

test("JSON case catalog covers Scrutiny A–C with correct gates", () => {
  assertCatalog(loadCases());
});

test("C14–C16 are block pixel cases with measurable expects (not empty skips)", () => {
  const pixel = casesForPlaywrightProject("pixel");
  const desktop = casesForPlaywrightProject("desktop");
  assert.ok(
    pixel.some((c) => c.id === "C14"),
    "pixel project must run C14",
  );
  assert.ok(
    !desktop.some((c) => c.id.startsWith("C")),
    "desktop project must not register C14–C16 (skip-free pixel ownership)",
  );

  const required: Record<string, string[]> = {
    C14: ["viewport", "boardFullyVisible", "noVerticalClip", "chromeAboveHomeBar"],
    C15: ["versionReadable", "bestReadable"],
    C16: ["boardFullyVisible", "cellsUsable", "inViewport"],
  };
  for (const [id, asserts] of Object.entries(required)) {
    const c = pixel.find((x) => x.id === id);
    assert.ok(c, `missing ${id}`);
    assert.equal(c.layer, "pixel");
    assert.equal(c.gate, "block");
    const names = [...c.steps, ...c.expect]
      .map((x) => String((x as { assert?: string }).assert ?? ""))
      .filter(Boolean);
    for (const a of asserts) {
      assert.ok(names.includes(a), `${id} must assert ${a} (got ${names.join(",")})`);
    }
  }
});

for (const c of loadCases({ layer: "unit" })) {
  test(`${c.id}: ${c.title}`, () => {
    runUnitCase(c);
  });
}
