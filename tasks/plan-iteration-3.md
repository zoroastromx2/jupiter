# Implementation Plan: Quality Gate (Iteration 3)

**Status:** approved · implemented · measured (2026-11-18)
**Spec:** `SPEC.md` v1.3 (G5, G13)
**Scope:** two independent quality gaps requested together.

## Overview

G5 asked for an automated performance budget; G13 asked to replace the
deprecated `THREE.Clock`. Both are infrastructure changes with no product
surface. They share no code, only the same verification pass.

## Workstreams

| Workstream | Gap | Deliverable |
|---|---|---|
| `perf-budget` | G5 | `scripts/perf-budget.mjs`, `npm run perf`, CI `perf` job gating deploy |
| `timer` | G13 | `THREE.Timer` in `main.js`, no deprecation warning, time controls intact |

Build order: independent; `perf-budget` after `timer` so the budget measures the
final frame loop.

## Architecture decisions

- **AD1 — Budget as a Node script, not Lighthouse/Playwright.** The repo already
  has Vite and a production build; a ~300-line CDP script needs no new
  dependency and reuses the system Chrome. `CHROME_PATH` covers non-standard
  installs.
- **AD2 — Deterministic budgets.** The gate checks four things: zero GLB
  requests before the first frame, initial transfer ≤ 4 MB, first frame ≤ 5 s
  under forced SwiftShader, and no `THREE.Clock` warning. The structural and
  byte checks catch the regression that mattered (models back in boot) without
  depending on runner speed; the time ceiling is deliberately loose.
- **AD3 — CI owns the gate.** A `perf` job on Node 22 builds with the default
  relative base, runs `npm run perf`, and `deploy` now needs `[build, perf]`.
  The build job keeps its Pages base path; the perf build is measured at `/`.
- **AD4 — Timer migration keeps behaviour.** `Timer.update()` runs once per
  frame, `getDelta()` replaces `Clock.getDelta()`, `getElapsed()` replaces
  `clock.elapsedTime`, and `reset()` before the first frame replaces
  `clock.start()` so the first delta is not a jump. `connect(document)` adds
  Page Visibility handling.
- **AD5 — No new dependency, no asset change.** Only dev tooling, one workflow
  job, one source file and docs.

## Results

| Check | Result |
|---|---|
| `npm test` | 10 files / 48 tests / 559 ms |
| `npm run build` | 44 modules / 295 ms; JS 160.76 kB + three 670.66 kB (gzip 54.04 + 167.40) |
| `npm run perf` (forced SwiftShader) | first frame 3,075 ms (budget 5,000); transfer 3,373,490 B (budget 4,000,000); 0 GLBs; 0 exceptions; 0 Clock warnings |
| Budget failure path | `PERF_FIRST_FRAME_MS=1` → exit 1 with a clear failure line |
| Timer smoke | time +2 h in 2 s at ×1; pause held; resume advanced; 0 exceptions |
| Cleanup | Chrome/profile temp dirs removed; no leftovers |

## Verification procedure

```powershell
npm test
npm run build
npm run perf
```

`npm run perf` serves `dist/` itself, launches headless Chrome with
`--use-angle=swiftshader`, applies 20 Mbps / 40 ms throttling, waits for the
`jovian:first-frame` mark, and fails on any budget breach. It requires Node 22+
and Chrome/Chromium/Edge.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| CI runner lacks Chrome | Perf job fails | `CHROME_PATH`, `google-chrome`/`chromium` discovery; first push validates |
| CI WebGL2 unavailable | First-frame mark missing | `--enable-unsafe-swiftshader` + forced ANGLE SwiftShader; verified locally |
| Software rendering slower than local GPU | Time budget flaky | 5 s ceiling; structural/byte checks are the real gate |
| Node 22 requirement surprises Node 20 users | `npm run perf` fails | Clear error message and README note; app itself still runs on 20.19 |
| Timer changes frame timing | Time controls drift | `reset()` before the loop; browser smoke of advance/pause/resume |

## Open questions

1. **CI confirmation:** the `perf` job is validated locally; the first push is
   the final check.
2. **G5 scope:** the budget is automated and gating, but only on push to `main`;
   `pull_request` checks remain deferred.
3. **G13 scope:** complete; no further `Clock` usage remains.
