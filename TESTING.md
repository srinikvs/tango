# Testing Tango

JSON case files under `tests/cases/` are the **source of truth**. Unit (`npm test`) and Playwright (`npm run test:e2e`) load those files and drive assertions from `steps` / `expect`. Do not add a new Scrutiny scenario only as hard-coded TypeScript.

CSV export of results is optional later. JSON stays canonical. There is no spreadsheet ingest.

## Case files

Path: `tests/cases/*.json` (one case = one object / file).

| Field | Required | Values |
|---|---|---|
| `id` | yes | Stable id (`A1`, `B7`, `C14`, …) |
| `layer` | yes | `unit` \| `e2e` \| `pixel` |
| `title` | yes | Human-readable name |
| `steps` | yes | Interpreter ops (`openFresh`, `waitPlay`, `click`, `recordBest`, …) |
| `expect` | yes | Interpreter asserts (`visible`, `boardFullyVisible`, `placedSunAfterTap`, …) |
| `gate` | yes | `block` (fails **TEST PASS**) \| `optional` |
| `viewport` | no | `desktop` for the 1280×800 smoke; otherwise Pixel project |

**Add a feature:** add or edit a JSON file, then re-run `npm test` and/or `npm run test:e2e`. Extend `tests/cases/unit-runner.ts` or `tests/e2e/case-runner.ts` only when you need a new op/assert.

Gate mapping: E2E **7–10** (`B7`–`B10`) and Pixel **14–16** (`C14`–`C16`) use `gate: "block"`. Do not skip, soften, or `fixme` those cases.

Manual-only items are **not** JSON cases and are not executed (see below).

## Local

```bash
npm install
npx playwright install --with-deps chromium

npm test                 # loads tests/cases/*.json (layer=unit) + catalog checks
npm run test:e2e         # Playwright pixel + desktop; loads e2e/pixel JSON cases
npm run test:e2e:pixel   # Pixel 7a project only (412×915)
npm run test:e2e:desktop # 1280×800 Start smoke (B-desktop-start)
```

Unit tests use **tsx** (`tsx --test src/game/*.test.ts`), not `node --experimental-strip-types`, so Jenkins Node can run them without a newer experimental flag.

`npm run test:e2e:pixel` runs **only** the Pixel catalog (`tests/e2e/pixel.catalog.spec.ts`): B7–B11 plus C14–C16. Those cases are registered on the pixel project — they are not `test.skip` placeholders. The desktop project loads `desktop.catalog.spec.ts` (Start smoke only) and does not list C14–C16.

`test:e2e` builds `dist/` and starts `vite preview` at `http://127.0.0.1:4173/tango/` unless `BASE_URL` is set. Failure screenshots land in `test-results/`.

**CI e2e must pass on local preview by default.** Do not require a live host for Jenkins green.

## Live smoke (`BASE_URL`)

Default local preview: `http://127.0.0.1:4173/tango/` (Vite `base` is `/tango/`).

Verified Playadda mounts (see `deploy/nginx.tango.conf` and `vite.config.ts`):

```bash
BASE_URL=https://playaddatest.duckdns.org/tango/ npm run test:e2e
BASE_URL=https://playadda.duckdns.org/tango/ npm run test:e2e
```

When `BASE_URL` is set, Playwright does not start a local webServer.

If the live build **lacks `data-testid` hooks** (a deploy that predates this suite), cases **skip** with:

> Live BASE_URL lacks data-testid hooks (this deploy predates the test suite). CI e2e is intended to pass on local preview — unset BASE_URL to use http://127.0.0.1:4173/tango/, or deploy a hooked build.

That is the Pac-Man lesson: live without hooks must not fail CI. Local preview on this branch has the hooks and must pass.

## Catalog (A–C)

| id | Layer | Gate | Coverage |
|---|--------|------|----------|
| A1 | unit | optional | Cell cycle empty → sun → moon (and reverse) |
| A2 | unit | optional | Triple / balance / constraint violations |
| A3 | unit | optional | Daily solution is solved; givens are not |
| A4 | unit | optional | `formatTime` m:ss |
| A5 | unit | optional | Best time writes `playadda-tango-v1`; reload restores; daily streak |
| A6 | unit | optional | `VERSION` matches `package.json` / shipped UI tag |
| B7 | e2e | **block** | How-to-play before play; Start on the same screen |
| B8 | e2e | **block** | Version ID on start chrome and play HUD (`v1.x.x`) |
| B9 | e2e | **block** | Best time shown from localStorage; survives reload |
| B10 | e2e | **block** | After Start, one tap on an empty cell places a sun |
| B11 | e2e | optional | Hard refresh returns a usable How-to + Start screen |
| C14 | pixel | **block** | Start + play chrome visible; no vertical / home-bar clip |
| C15 | pixel | **block** | Version + Best readable on 412×915 portrait |
| C16 | pixel | **block** | Board usable after Start; cells unclipped and tappable |

`src/game/cases.test.ts` fails if a required id is missing or a block case is not `gate: "block"`.

## Manual-only (do not automate, not in JSON)

C14 home-bar coverage in CI is a CSS `--sab` emulation (34px) plus Chromium 412×915. Still manual:

- Real Pixel 7a / Android Chrome gesture-bar and cutout.
- iPhone Safari-only visual quirks (dynamic toolbar, `visualViewport` dips, rubber-band).
- Solving a full daily / practice puzzle and win-screen timing.
- Subjective aesthetics beyond measurable clip, target size, and readable HUD chrome.
- Weekly prod / merge greenlights and sign-off rituals.

## Hooks

Stable `data-testid` attributes (`version`, `start-version`, `howto`, `start`, `start-panel`, `overlay`, `hud`, `best`, `best-value`, `board`, `cell-*`, `toolbar`, `play`, `stats`). Gameplay logic is unchanged. Live hosts that omit these hooks skip instead of failing.
