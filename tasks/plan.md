# Implementation Plan: Baseline Hardening (Iteration 1)

**Status:** approved · implemented · CI verified (run 44454516000)

## Overview

`SPEC.md` v1.0 (baseline) was approved on 2026-11-18. This iteration closes the
four gaps that need **no product, licensing or dependency decisions**, and that
protect every later iteration: deploys run without tests, the J2000 epoch is
duplicated, a browser global is read unguarded, and the camera state machine is
untested. It changes no user-visible behaviour.

The remaining gaps (G2 licence, G5 boot performance, G6 lint/coverage, G7 i18n,
G8 fonts, G9 module splits, G10 context loss, G11 visual baselines, G12 dist)
are explicitly out of scope and will be proposed as separate iterations.

## Architecture decisions

- **AD1 — Gate the existing workflow, don't add a CI system.** The repository
  deploys from `main` through one GitHub Actions workflow. A `test` job that
  `build` depends on is the smallest change that prevents a broken deploy. PR
  triggers and coverage gates are deferred (open question 2).
- **AD2 — `AstroScale.js` is the only source of time constants.** Delete the
  private copies in `MissionSimulator.js`; do not re-export or keep aliases.
  The existing tests already pin the constants, so the dedupe is behaviour
  preserving.
- **AD3 — Test the camera with real Three objects and a stub `OrbitControls`.**
  Camera state is the riskiest untested surface. GSAP tweens are driven
  synchronously with `tween.progress(1)` so tests use no timers and no new
  dependency. If GSAP cannot load in the Node environment, stub `window` /
  `document` before a dynamic import; adding jsdom requires approval first.
- **AD4 — No production behaviour changes.** Only `StarfieldSimulator` gains a
  guard and `MissionSimulator` loses duplicated constants. If a new test
  exposes a real defect, fix it minimally and record it in the task.

## Dependency graph

```
T1 CI test gate ──────────────► (guards T2-T4)
T2 Epoch single source ───────► independent
T3 Starfield guard + test ────► independent
T4 CameraController tests ────► independent
```

All four tasks are independent. T1 lands first so that T2-T4 are covered by the
new gate. T3 and T4 both grow the suite and can be done in either order.

## Task index

Full acceptance criteria and file lists live in `tasks/todo.md`.

| ID | Task | Size | Depends on | Primary files |
|---|---|---|---|---|
| T1 | Run tests before deploy | S | — | `.github/workflows/deploy.yml` |
| T2 | Single source for J2000 constants | XS | — | `src/core/MissionSimulator.js` |
| T3 | Guard `StarfieldSimulator` for non-browser runtimes | S | — | `src/core/StarfieldSimulator.js`, `tests/StarfieldSimulator.test.js` |
| T4 | Cover the camera state machine | M | — | `tests/CameraController.test.js` |

## Phases and checkpoints

### Phase 1 — Gate and dedupe (T1, T2)

- Add the `test` job and make `build` depend on it.
- Import `J2000_EPOCH_MS` / `MS_PER_DAY` from `AstroScale.js` in `MissionSimulator.js`.

**Checkpoint CP1** — passed
- [x] `git diff` shows only the workflow and the two imports/removals.
- [x] `npm test` → 33/33 at this checkpoint.
- [x] `npm run build` → exit 0.
- [x] Workflow graph reviewed: `deploy → build → test`.

### Phase 2 — Cover the blind spots (T3, T4)

- Guard the pixel-ratio read and add a Node-side starfield test.
- Add the camera tests (focus, follow, surface, instrument, lens, exit).

**Checkpoint CP2** — passed
- [x] `npm test` → 41/41.
- [x] `npm run build` → exit 0.
- [x] Browser smoke: target, surface, Esc, Juno mission, instrument, lens
      (headless Chrome 157; 75 FPS; zero exceptions).

### Final checkpoint — passed
- [x] All acceptance criteria in `tasks/todo.md` met.
- [x] No new dependency, no user-visible change, no asset change.
- [x] Diff reviewed and committed; CI test → build → deploy green.

## Verification

| Gate | Command | Pass condition |
|---|---|---|
| Unit | `npm test` | All tests pass; 41 after T4 |
| Build | `npm run build` | Exit 0, `dist/` emitted |
| CI graph | read `.github/workflows/deploy.yml` | `deploy` cannot run without `test` |
| Browser | headless Chrome via CDP | Loader hidden, WebGL2, no exceptions |
| Hygiene | `git diff --stat` | ≤ 6 code/test files (planning docs excluded), no lockfile churn |

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| GSAP touches `window`/`document` in Node | T4 blocked | Stub globals before dynamic import; if impossible, stop and propose jsdom as an explicit dependency decision |
| CI YAML cannot be executed locally | Gate unverified until pushed | Review the `needs` graph and YAML structure; push only with user consent; confirm on the Actions run |
| Tests encode current quirks as contracts | False confidence | Assert observable state (camera position, fov, flags), not private internals |
| Scope creep into `main.js` tests | Iteration grows | `main.js` stays out of scope; note it for Iteration 2 |
| Tween-driven flakiness | Red CI | Drive progress synchronously; never wait on real time |

## Rollback

Every task is a small, independent commit. Reverting T1 restores the old
workflow; reverting T2 restores the local constants; T3/T4 are tests plus one
guard and revert cleanly. No data, schema or asset migration is involved.

## Outcome (2026-11-18)

| Item | Result |
|---|---|
| T1 | `test` job added; `build` needs `test`; triggers/permissions unchanged. CI run 44454516000: test ✓. |
| T2 | `MissionSimulator` imports the shared epoch constants; no literals left. |
| T3 | `typeof window` guard; 3 Node tests (failed first, then passed). |
| T4 | 5 camera tests; a deliberate lens mutation failed the suite. |
| Suite | 41 tests / 10 files / 549 ms. |
| Build | 44 modules / 369 ms; no bundle regression. |
| Browser | Chrome 157 headless, 1440×900, WebGL2, 75 FPS, 0 exceptions, 1 warning (`THREE.Clock`). |

## Open questions

1. **Resolved:** "harden the base" was approved and completed. The next iteration
   still needs a choice: performance, i18n, licence or Saturn.
2. **PR gate.** Should tests also run on `pull_request` (separate `ci.yml`), and
   should coverage become a gate? Both are deferred here.
3. **Licence (G2).** Not blocking this iteration, but it blocks distribution;
   schedule the decision separately.
